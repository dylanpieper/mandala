//! The window's side of Mandala: Tauri commands that call `mandala-core`, a
//! file watcher, and the closing moment. No logic about notes lives here;
//! if a command grows a rule, the rule belongs in the core.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use chrono::Utc;
use mandala_core::arrange::Plan;
use mandala_core::mandala::Mandala;
use mandala_core::order::sort_by_order;
use mandala_core::rename::{Follow, Renamed};
use mandala_core::search::Hit;
use mandala_core::{Arrival, Life, Note, NoteRef, Place, Settled, Vault};
use notify::{RecursiveMode, Watcher};
use serde::Serialize;
use std::path::PathBuf;
use std::sync::Mutex;
#[cfg(target_os = "macos")]
use tauri::menu::{Menu, MenuItem, MenuItemKind, Submenu, WINDOW_SUBMENU_ID};
use tauri::{AppHandle, Emitter, Manager, RunEvent, State, WindowEvent};

#[derive(Default)]
struct App {
    vault: Mutex<Option<Vault>>,
    watcher: Mutex<Option<notify::RecommendedWatcher>>,
}

type Res<T> = Result<T, String>;

/// How long the vault must be still before the window hears it changed.
const QUIET: std::time::Duration = std::time::Duration::from_millis(250);
/// A long sync still refreshes the window this often.
const LONGEST: std::time::Duration = std::time::Duration::from_secs(2);

fn with<T>(app: &State<App>, f: impl FnOnce(&Vault) -> anyhow::Result<T>) -> Res<T> {
    let guard = app.vault.lock().map_err(|e| e.to_string())?;
    let vault = guard.as_ref().ok_or("no vault is open")?;
    f(vault).map_err(|e| format!("{e:#}"))
}

#[derive(Serialize)]
struct VaultInfo {
    root: String,
    name: String,
    arranged: bool,
}

#[derive(Serialize)]
struct SandItem {
    #[serde(flatten)]
    note: NoteRef,
    fraction_left: f64,
}

#[derive(Serialize)]
struct Overview {
    stone: Vec<Note>,
    sand: Vec<SandItem>,
    elsewhere: Vec<Note>,
    /// Folders directly in `stone/`, empty ones included.
    folders: Vec<String>,
}

fn last_vault_file(app: &AppHandle) -> anyhow::Result<PathBuf> {
    Ok(app.path().app_data_dir()?.join("last-vault.txt"))
}

/// For trying things: `MANDALA_VAULT=<path> npm run app` opens that vault
/// (a sample one) without becoming the vault the app remembers.
fn vault_override() -> Option<String> {
    std::env::var("MANDALA_VAULT").ok().filter(|p| !p.is_empty())
}

#[tauri::command]
fn last_vault(app: AppHandle) -> Option<String> {
    if let Some(path) = vault_override() {
        return Some(path);
    }
    std::fs::read_to_string(last_vault_file(&app).ok()?).ok().map(|s| s.trim().to_string())
}

#[tauri::command]
fn open_vault(app: AppHandle, state: State<App>, path: String) -> Res<VaultInfo> {
    let root = PathBuf::from(&path);
    let name = root.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_else(|| "vault".into());
    let data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let vault = Vault::open(&root, data.join("vaults").join(&name)).map_err(|e| format!("{e:#}"))?;
    let info = VaultInfo { root: path.clone(), name, arranged: vault.is_arranged() };
    if vault_override().is_none() {
        let _ = std::fs::create_dir_all(&data);
        let _ = std::fs::write(data.join("last-vault.txt"), &path);
    }

    // Tell the window when anything in the vault changes (the phone, via iCloud).
    // Changes in dot folders (`.mandala/life.json`, `.obsidian/`) are not
    // notes; passing them on let Mandala's own clock writes wake it forever.
    // A sync tool or a save writes a burst of events; the window refreshes once,
    // after the vault has been quiet for a moment. The thread ends when the
    // watcher (and so the sender) is dropped.
    let (tx, rx) = std::sync::mpsc::channel::<()>();
    let handle = app.clone();
    std::thread::spawn(move || {
        while rx.recv().is_ok() {
            let first = std::time::Instant::now();
            while first.elapsed() < LONGEST && rx.recv_timeout(QUIET).is_ok() {}
            let _ = handle.emit("vault-changed", ());
        }
    });
    let watched = root.clone();
    let mut watcher = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
        let Ok(event) = res else { return };
        let about_notes = event.paths.iter().any(|p| {
            let rel = p.strip_prefix(&watched).unwrap_or(p);
            !rel.components().any(|c| c.as_os_str().to_string_lossy().starts_with('.'))
        });
        if about_notes {
            let _ = tx.send(());
        }
    })
    .map_err(|e| e.to_string())?;
    watcher.watch(&root, RecursiveMode::Recursive).map_err(|e| e.to_string())?;

    // A rename that stopped part-way (the app quit mid-way) is finished first.
    vault.finish_renames().map_err(|e| format!("{e:#}"))?;
    *state.watcher.lock().map_err(|e| e.to_string())? = Some(watcher);
    *state.vault.lock().map_err(|e| e.to_string())? = Some(vault);
    Ok(info)
}

#[tauri::command]
fn arrange_plan(state: State<App>) -> Res<Plan> {
    with(&state, |v| v.arrange_plan())
}

#[tauri::command]
fn arrange(app: AppHandle, state: State<App>, snapshot: bool, obsidian_to_sand: bool, only: Option<Vec<String>>) -> Res<()> {
    let snap = if snapshot {
        let stamp = Utc::now().format("%Y-%m-%d %H.%M").to_string();
        Some(app.path().app_data_dir().map_err(|e| e.to_string())?.join("snapshots").join(stamp))
    } else {
        None
    };
    with(&state, |v| {
        let plan = match &only {
            Some(chosen) => v.arrange_plan_only(chosen)?,
            None => v.arrange_plan()?,
        };
        v.arrange(&plan, snap.as_deref(), obsidian_to_sand)
    })
}

#[tauri::command]
fn pending_downloads(state: State<App>) -> Res<usize> {
    with(&state, |v| {
        v.request_downloads()?;
        Ok(v.pending_downloads())
    })
}

#[tauri::command]
fn arrive(state: State<App>) -> Res<Arrival> {
    with(&state, |v| v.arrive(Utc::now()))
}

#[tauri::command]
fn overview(state: State<App>) -> Res<Overview> {
    with(&state, |v| {
        let now = Utc::now();
        let clock = v.refresh(now)?;
        let mut stone = Vec::new();
        let mut elsewhere = Vec::new();
        for n in v.notes()? {
            match n.place {
                Place::Stone => stone.push(n),
                Place::Elsewhere => elsewhere.push(n),
                Place::Sand(_) => {}
            }
        }
        let mut sand: Vec<SandItem> = clock
            .grains
            .iter()
            .map(|(rel, g)| SandItem {
                note: NoteRef {
                    rel: rel.clone(),
                    title: mandala_core::vault::title_of(rel),
                    life: Some(g.life),
                    written: Some(g.written),
                    dissolves: g.dissolves,
                },
                fraction_left: g.fraction_left(now),
            })
            .collect();
        // Sand: soonest to leave first. Breaths leave when this visit ends,
        // so they come first. Stone: the person's own order, set by dragging.
        sand.sort_by_key(|s| s.note.dissolves.map(|d| d.timestamp()).unwrap_or(i64::MIN));
        sort_by_order(&mut stone, &v.order()?, |n| &n.rel);
        Ok(Overview { stone, sand, elsewhere, folders: v.stone_folders()? })
    })
}

#[tauri::command]
fn mandala(state: State<App>) -> Res<Mandala> {
    with(&state, |v| v.mandala(Utc::now()))
}

#[tauri::command]
fn read_note(state: State<App>, rel: String) -> Res<String> {
    with(&state, |v| v.read(&rel))
}

#[tauri::command]
fn write_note(state: State<App>, rel: String, text: String) -> Res<()> {
    with(&state, |v| v.write(&rel, &text))
}

#[tauri::command]
fn new_sand(state: State<App>, title: String, life: Life) -> Res<String> {
    with(&state, |v| v.new_sand(&title, life, Utc::now()))
}

#[tauri::command]
fn set_life(state: State<App>, rel: String, life: Life) -> Res<String> {
    with(&state, |v| v.set_life(&rel, life, Utc::now()))
}

#[tauri::command]
fn move_stone(state: State<App>, rel: String, folder: String) -> Res<String> {
    with(&state, |v| v.move_stone(&rel, &folder))
}

/// Leaving a note: its file name follows its heading, if the two agreed when it was opened.
#[tauri::command]
fn follow_heading(state: State<App>, rel: String, opened: String) -> Res<Follow> {
    with(&state, |v| v.follow_heading(&rel, &opened, Utc::now()))
}

/// Rename a note in its folder, links and all (also how a rename is undone).
#[tauri::command]
fn rename_note(state: State<App>, rel: String, stem: String) -> Res<Renamed> {
    with(&state, |v| v.rename_note(&rel, &stem))
}

/// Rename a note with no heading to the title typed for it (no heading is written).
#[tauri::command]
fn rename_to(state: State<App>, rel: String, title: String) -> Res<Follow> {
    with(&state, |v| v.rename_to(&rel, &title, Utc::now()))
}

#[tauri::command]
fn set_order(state: State<App>, rels: Vec<String>) -> Res<()> {
    with(&state, |v| v.set_order(&rels))
}

#[tauri::command]
fn keep(state: State<App>, rel: String, folder: String, because: Option<String>) -> Res<String> {
    with(&state, |v| v.keep(&rel, &folder, because.as_deref(), Utc::now()))
}

#[tauri::command]
fn let_go(state: State<App>, rels: Vec<String>) -> Res<Vec<Settled>> {
    with(&state, |v| v.let_go(&rels, Utc::now()))
}

#[tauri::command]
fn sweep_ran_out(state: State<App>) -> Res<Vec<Settled>> {
    with(&state, |v| {
        v.request_downloads()?;
        v.sweep_ran_out(Utc::now())
    })
}

#[tauri::command]
fn delete_note(state: State<App>, rel: String) -> Res<Settled> {
    with(&state, |v| v.delete(&rel, Utc::now()))
}

#[tauri::command]
fn restore(state: State<App>, id: String) -> Res<String> {
    with(&state, |v| v.restore(&id, Utc::now()))
}

#[tauri::command]
fn settling(state: State<App>) -> Res<Vec<Settled>> {
    with(&state, |v| v.settling())
}

/// The text of a settled note, to look at before restoring it.
#[tauri::command]
fn settled_text(state: State<App>, id: String) -> Res<String> {
    with(&state, |v| v.settled_text(&id))
}

#[tauri::command]
fn search(state: State<App>, query: String) -> Res<Vec<Hit>> {
    with(&state, |v| v.search(&query))
}

#[tauri::command]
fn backlinks(state: State<App>, title: String) -> Res<Vec<Note>> {
    with(&state, |v| v.backlinks(&title))
}

#[tauri::command]
fn carving(state: State<App>, rel: String) -> Res<Option<mandala_core::carve::Carving>> {
    with(&state, |v| v.carving(&rel))
}

/// A picture's bytes, raw (an `ArrayBuffer` in the window, no JSON).
#[tauri::command]
fn picture(state: State<App>, name: String) -> Res<tauri::ipc::Response> {
    with(&state, |v| v.read_picture(&name)).map(tauri::ipc::Response::new)
}

/// Save a picture sent as raw bytes. Its name comes in the `name` header
/// (percent-encoded); with `replace: 1`, an existing picture is changed.
#[tauri::command]
fn save_picture(state: State<App>, request: tauri::ipc::Request) -> Res<String> {
    let tauri::ipc::InvokeBody::Raw(bytes) = request.body() else { return Err("expected raw bytes".into()) };
    let header = |k: &str| request.headers().get(k).and_then(|h| h.to_str().ok()).map(str::to_string);
    let name = header("name").ok_or("no name")?;
    let name = percent_decode(&name);
    let replace = header("replace").as_deref() == Some("1");
    with(&state, |v| {
        if replace {
            v.replace_picture(&name, bytes)?;
            Ok(name.clone())
        } else {
            v.save_picture(&name, bytes)
        }
    })
}

#[tauri::command]
fn remove_picture(state: State<App>, name: String) -> Res<Settled> {
    with(&state, |v| v.remove_picture(&name, Utc::now()))
}

/// Undo `encodeURIComponent`: headers carry only ASCII.
fn percent_decode(s: &str) -> String {
    let b = s.as_bytes();
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'%' && i + 2 < b.len() {
            if let Ok(n) = u8::from_str_radix(&s[i + 1..i + 3], 16) {
                out.push(n);
                i += 3;
                continue;
            }
        }
        out.push(b[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

#[tauri::command]
fn carve(state: State<App>, rel: String, text: String) -> Res<()> {
    with(&state, |v| v.carve(&rel, &text, Utc::now()))
}

#[derive(Serialize)]
struct Woven {
    lines: Vec<mandala_core::combine::Line>,
    text: String,
    into: String,
    dragged: String,
}

/// Two notes woven into one, to show before combining. Nothing is written.
#[tauri::command]
fn weave(state: State<App>, into: String, dragged: String) -> Res<Woven> {
    with(&state, |v| {
        let (a, b) = (v.read(&into)?, v.read(&dragged)?);
        let lines = mandala_core::combine::weave(&a, &b);
        let text = mandala_core::combine::woven_text(&lines, &a);
        Ok(Woven { lines, text, into: a, dragged: b })
    })
}

#[tauri::command]
fn combine(state: State<App>, into: String, dragged: String, text: String) -> Res<Settled> {
    with(&state, |v| v.combine(&into, &dragged, &text, Utc::now()))
}

#[tauri::command]
fn breaths(state: State<App>) -> Res<Vec<NoteRef>> {
    with(&state, |v| v.breaths(Utc::now()))
}

/// End the visit (breaths settle) and quit. If the breaths could not settle,
/// stay open and say why: quitting anyway would leave the visit unclosed.
#[tauri::command]
fn close_visit(app: AppHandle, state: State<App>) -> Res<()> {
    let open = state.vault.lock().map_err(|e| e.to_string())?.is_some();
    if open {
        if let Err(e) = with(&state, |v| v.close(Utc::now()).map(|_| ())) {
            eprintln!("close_visit failed: {e}");
            return Err(e);
        }
    }
    app.exit(0);
    Ok(())
}

/// End the visit (breaths settle) and close the vault, but keep the app open:
/// the person is changing vaults. The vault stays remembered until another
/// is opened.
#[tauri::command]
fn leave_vault(state: State<App>) -> Res<()> {
    let open = state.vault.lock().map_err(|e| e.to_string())?.is_some();
    if open {
        with(&state, |v| v.close(Utc::now()).map(|_| ()))?;
    }
    *state.watcher.lock().map_err(|e| e.to_string())? = None;
    *state.vault.lock().map_err(|e| e.to_string())? = None;
    Ok(())
}

/// Tauri's default menu, with ⌘M opening the mandala view instead of
/// minimizing (the window's own button still minimizes).
#[cfg(target_os = "macos")]
fn menu(app: &AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let menu = Menu::default(app)?;
    if let Some(MenuItemKind::Submenu(window)) = menu.get(WINDOW_SUBMENU_ID) {
        window.remove_at(0)?;
    }
    let view = Submenu::with_items(
        app,
        "View",
        true,
        &[&MenuItem::with_id(app, "mandala", "Mandala", true, Some("CmdOrCtrl+M"))?],
    )?;
    let at = menu.items()?.len().saturating_sub(2); // before Window and Help
    menu.insert(&view, at)?;
    Ok(menu)
}

fn main() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(App::default());
    // A Mac app has a menu bar; elsewhere the window handles its own
    // shortcuts and shows no menu.
    #[cfg(target_os = "macos")]
    let builder = builder.menu(menu).on_menu_event(|app, event| {
        if event.id() == "mandala" {
            let _ = app.emit("toggle-mandala", ());
        }
    });
    let app = builder
        .on_window_event(|window, event| {
            // Closing is a moment, not a click: the window shows the breaths
            // that leave, then calls `close_visit`.
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.emit("close-requested", ());
            }
        })
        .invoke_handler(tauri::generate_handler![
            last_vault,
            open_vault,
            arrange_plan,
            follow_heading,
            rename_note,
            rename_to,
            arrange,
            pending_downloads,
            arrive,
            overview,
            mandala,
            read_note,
            write_note,
            new_sand,
            set_life,
            move_stone,
            set_order,
            keep,
            let_go,
            sweep_ran_out,
            delete_note,
            restore,
            settling,
            settled_text,
            search,
            backlinks,
            carving,
            carve,
            picture,
            save_picture,
            remove_picture,
            weave,
            combine,
            breaths,
            close_visit,
            leave_vault,
        ])
        .build(tauri::generate_context!())
        .expect("Mandala could not start");

    app.run(|handle, event| {
        // ⌘Q asks the same as closing the window. `close_visit` exits with a
        // code, which is let through.
        if let RunEvent::ExitRequested { api, code, .. } = event {
            if code.is_none() {
                api.prevent_exit();
                let _ = handle.emit("close-requested", ());
            }
        }
    });
}
