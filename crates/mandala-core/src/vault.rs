//! The vault: an Obsidian vault on disk, edited in place.

use crate::clock::{Clock, Grain};
use crate::fsx::{rel_of, write_atomic};
use crate::lifespan::{place_of, Place};
use anyhow::{bail, Context, Result};
use chrono::{DateTime, Utc};
use serde::Serialize;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

/// Mandala's folder inside the vault. Obsidian hides folders that start with a dot.
pub const DOT: &str = ".mandala";

pub struct Vault {
    root: PathBuf,
    /// Outside iCloud (Application Support): what must not sync, such as the
    /// last-seen copy of each note used as the base for merges.
    state: PathBuf,
}

#[derive(Clone, Debug, Serialize)]
pub struct Note {
    pub rel: String,
    pub title: String,
    pub place: Place,
    pub modified: DateTime<Utc>,
}

impl Vault {
    pub fn open(root: impl Into<PathBuf>, state: impl Into<PathBuf>) -> Result<Vault> {
        let root = root.into();
        let state = state.into();
        if !root.is_dir() {
            bail!("{} is not a folder", root.display());
        }
        fs::create_dir_all(&state)?;
        Ok(Vault { root, state })
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn state_dir(&self) -> &Path {
        &self.state
    }

    pub(crate) fn dot(&self) -> PathBuf {
        self.root.join(DOT)
    }

    /// The absolute path of a note, refusing anything that leaves the vault.
    pub fn path(&self, rel: &str) -> Result<PathBuf> {
        let p = Path::new(rel);
        if rel.is_empty() || p.is_absolute() || p.components().any(|c| !matches!(c, std::path::Component::Normal(_))) {
            bail!("not a path inside the vault: {rel}");
        }
        Ok(self.root.join(p))
    }

    pub fn is_arranged(&self) -> bool {
        self.root.join("stone").is_dir() && self.root.join("sand").is_dir()
    }

    pub fn clock_path(&self) -> PathBuf {
        self.dot().join("life.json")
    }

    pub fn load_clock(&self) -> Result<Clock> {
        Clock::load(&self.clock_path())
    }

    pub fn save_clock(&self, clock: &Clock) -> Result<()> {
        clock.save(&self.clock_path())
    }

    /// The folders directly inside `stone/`, sorted, empty ones included, so
    /// a folder stays a place to move notes into after its last note leaves.
    pub fn stone_folders(&self) -> Result<Vec<String>> {
        let mut out = Vec::new();
        let Ok(entries) = fs::read_dir(self.root.join("stone")) else { return Ok(out) };
        for entry in entries {
            let entry = entry?;
            let name = entry.file_name().to_string_lossy().into_owned();
            if entry.file_type()?.is_dir() && !name.starts_with('.') {
                out.push(name);
            }
        }
        out.sort();
        Ok(out)
    }

    /// Every markdown note, skipping dot folders (`.obsidian`, `.mandala`, iCloud placeholders).
    pub fn notes(&self) -> Result<Vec<Note>> {
        let mut notes = Vec::new();
        let walker = walkdir::WalkDir::new(&self.root)
            .into_iter()
            .filter_entry(|e| e.depth() == 0 || !e.file_name().to_string_lossy().starts_with('.'));
        for entry in walker {
            let entry = entry?;
            if !entry.file_type().is_file() || entry.path().extension().is_none_or(|e| e != "md") {
                continue;
            }
            let rel = rel_of(&self.root, entry.path()).context("note outside vault")?;
            let modified = entry.metadata()?.modified()?.into();
            notes.push(Note { title: title_of(&rel), place: place_of(&rel), modified, rel });
        }
        notes.sort_by(|a, b| a.rel.cmp(&b.rel));
        Ok(notes)
    }

    pub fn read(&self, rel: &str) -> Result<String> {
        let p = self.path(rel)?;
        fs::read_to_string(&p).with_context(|| format!("reading {rel}"))
    }

    pub fn write(&self, rel: &str, text: &str) -> Result<()> {
        write_atomic(&self.path(rel)?, text.as_bytes())?;
        self.remember(rel, text)
    }

    /// Reconcile and save: call whenever the watcher says the vault changed.
    /// Saves only when something changed, so a refresh never wakes the
    /// watcher by itself (that loop froze the window).
    pub fn refresh(&self, now: DateTime<Utc>) -> Result<Clock> {
        let before = self.load_clock()?;
        let mut clock = before.clone();
        self.reconcile(&mut clock, now)?;
        if clock != before {
            self.save_clock(&clock)?;
        }
        Ok(clock)
    }

    /// Bring the clock up to date with the sand on disk: new notes get a
    /// "written" time, moved notes keep theirs (followed by inode), and notes
    /// that are gone are forgotten.
    pub fn reconcile(&self, clock: &mut Clock, now: DateTime<Utc>) -> Result<()> {
        let old = std::mem::take(&mut clock.grains);
        let by_ino: HashMap<u64, &Grain> = old.values().filter_map(|g| g.ino.map(|i| (i, g))).collect();
        for note in self.notes()? {
            let Place::Sand(life) = note.place else { continue };
            let path = self.path(&note.rel)?;
            let meta = fs::metadata(&path)?;
            let ino = inode(&path);
            let mut grain = match (old.get(&note.rel), ino.and_then(|i| by_ino.get(&i))) {
                (Some(g), _) if g.life == life => g.clone(),
                (Some(g), _) => g.relife(life),
                (None, Some(g)) => g.relife(life),
                // A sync copy of sand keeps its note's clock: no extra life.
                (None, None) => match self.copy_of(&note.rel)?.and_then(|o| old.get(&o)) {
                    Some(g) => g.relife(life),
                    None => Grain::new(life, written_estimate(&meta, now), clock.visit, ino),
                },
            };
            grain.ino = ino;
            clock.grains.insert(note.rel, grain);
        }
        Ok(())
    }
}

pub fn title_of(rel: &str) -> String {
    let name = rel.rsplit('/').next().unwrap_or(rel);
    name.strip_suffix(".md").unwrap_or(name).to_string()
}

/// When a note was written, as best the file can say. iCloud may set the
/// creation time to when it downloaded the file, so the earliest of creation
/// and modification wins.
fn written_estimate(meta: &fs::Metadata, now: DateTime<Utc>) -> DateTime<Utc> {
    let mut t = now;
    if let Ok(c) = meta.created() {
        t = t.min(c.into());
    }
    if let Ok(m) = meta.modified() {
        t = t.min(m.into());
    }
    t
}

/// The file's identity on its disk, which stays the same when it is renamed
/// or moved on that disk: the inode on a Mac, the file index on Windows.
#[cfg(unix)]
pub(crate) fn inode(path: &Path) -> Option<u64> {
    use std::os::unix::fs::MetadataExt;
    fs::metadata(path).ok().map(|m| m.ino())
}

#[cfg(windows)]
pub(crate) fn inode(path: &Path) -> Option<u64> {
    use std::os::windows::io::AsRawHandle;
    use windows_sys::Win32::Storage::FileSystem::{GetFileInformationByHandle, BY_HANDLE_FILE_INFORMATION};
    let file = fs::File::open(path).ok()?;
    // SAFETY: the handle is open for the call, and `info` is plain data.
    let mut info: BY_HANDLE_FILE_INFORMATION = unsafe { std::mem::zeroed() };
    let ok = unsafe { GetFileInformationByHandle(file.as_raw_handle() as _, &mut info) };
    (ok != 0).then(|| (u64::from(info.nFileIndexHigh) << 32) | u64::from(info.nFileIndexLow))
}

#[cfg(not(any(unix, windows)))]
pub(crate) fn inode(_path: &Path) -> Option<u64> {
    None
}

#[cfg(test)]
pub(crate) mod testing {
    use super::*;
    use chrono::TimeZone;

    pub struct Fixture {
        pub vault: Vault,
        _dirs: (tempfile::TempDir, tempfile::TempDir),
    }

    /// An arranged vault in a temp folder, with a separate state folder.
    pub fn arranged() -> Fixture {
        let root = tempfile::tempdir().unwrap();
        let state = tempfile::tempdir().unwrap();
        for d in ["stone", "sand/breath", "sand/sun", "sand/moon/quarter", "sand/moon/half", "sand/moon/full"] {
            fs::create_dir_all(root.path().join(d)).unwrap();
        }
        let vault = Vault::open(root.path(), state.path()).unwrap();
        Fixture { vault, _dirs: (root, state) }
    }

    pub fn put(v: &Vault, rel: &str, text: &str) {
        let p = v.path(rel).unwrap();
        fs::create_dir_all(p.parent().unwrap()).unwrap();
        fs::write(p, text).unwrap();
    }

    /// A moment far in the future, so files written now count as written before it.
    pub fn later(days: i64) -> DateTime<Utc> {
        Utc::now() + chrono::Duration::days(days)
    }

    pub fn at(y: i32, m: u32, d: u32) -> DateTime<Utc> {
        Utc.with_ymd_and_hms(y, m, d, 12, 0, 0).unwrap()
    }
}

#[cfg(test)]
mod tests {
    use super::testing::*;
    use super::*;
    use crate::lifespan::Life;

    #[test]
    fn refuses_paths_that_leave_the_vault() {
        let f = arranged();
        assert!(f.vault.path("../x.md").is_err());
        assert!(f.vault.path("/etc/passwd").is_err());
        assert!(f.vault.path("stone/../../x.md").is_err());
        assert!(f.vault.path("").is_err());
        assert!(f.vault.path("stone/x.md").is_ok());
    }

    #[test]
    fn lists_notes_but_not_dot_folders() {
        let f = arranged();
        put(&f.vault, "stone/a.md", "a");
        put(&f.vault, "sand/sun/b.md", "b");
        put(&f.vault, ".obsidian/x.md", "x");
        put(&f.vault, ".mandala/settling/1/c.md", "c");
        put(&f.vault, "stone/.c.md.icloud", "");
        let rels: Vec<_> = f.vault.notes().unwrap().into_iter().map(|n| n.rel).collect();
        assert_eq!(rels, vec!["sand/sun/b.md", "stone/a.md"]);
    }

    #[test]
    fn reconcile_starts_clocks_and_forgets_the_gone() {
        let f = arranged();
        put(&f.vault, "sand/sun/a.md", "a");
        put(&f.vault, "stone/k.md", "k");
        let mut clock = Clock::default();
        f.vault.reconcile(&mut clock, later(1)).unwrap();
        assert_eq!(clock.grains.len(), 1);
        let g = &clock.grains["sand/sun/a.md"];
        assert_eq!(g.life, Life::Sun);
        assert!(g.written <= Utc::now());

        fs::remove_file(f.vault.path("sand/sun/a.md").unwrap()).unwrap();
        f.vault.reconcile(&mut clock, later(1)).unwrap();
        assert!(clock.grains.is_empty());
    }

    #[test]
    fn stone_folders_include_empty_ones() {
        let f = arranged();
        put(&f.vault, "stone/life/a.md", "a");
        fs::create_dir_all(f.vault.root().join("stone/prompts")).unwrap();
        fs::create_dir_all(f.vault.root().join("stone/.hidden")).unwrap();
        put(&f.vault, "stone/loose.md", "l");
        assert_eq!(f.vault.stone_folders().unwrap(), vec!["life", "prompts"]);
    }

    #[test]
    fn refresh_writes_the_clock_only_when_it_changed() {
        let f = arranged();
        put(&f.vault, "sand/sun/a.md", "a");
        f.vault.refresh(later(1)).unwrap();
        let path = f.vault.clock_path();
        let first = fs::metadata(&path).unwrap().modified().unwrap();
        std::thread::sleep(std::time::Duration::from_millis(20));

        f.vault.refresh(later(2)).unwrap();
        assert_eq!(fs::metadata(&path).unwrap().modified().unwrap(), first, "nothing changed, nothing written");

        put(&f.vault, "sand/sun/b.md", "b");
        f.vault.refresh(later(3)).unwrap();
        assert!(f.vault.load_clock().unwrap().grains.contains_key("sand/sun/b.md"));
    }

    #[test]
    fn a_moved_note_keeps_its_clock_and_cannot_be_extended() {
        let f = arranged();
        put(&f.vault, "sand/sun/a.md", "a");
        let mut clock = Clock::default();
        f.vault.reconcile(&mut clock, Utc::now()).unwrap();
        let before = clock.grains["sand/sun/a.md"].clone();

        // Moved to a full moon, as on the phone.
        fs::rename(f.vault.path("sand/sun/a.md").unwrap(), f.vault.path("sand/moon/full/a.md").unwrap()).unwrap();
        f.vault.reconcile(&mut clock, Utc::now()).unwrap();
        let after = &clock.grains["sand/moon/full/a.md"];
        assert_eq!(after.life, Life::Full);
        assert_eq!(after.written, before.written);
        assert_eq!(after.dissolves, before.dissolves, "a move can shorten a lifespan, never extend it");
    }
}
