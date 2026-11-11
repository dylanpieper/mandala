# Working on Mandala

How Mandala is built, the rules that hold everywhere, and how to run and check it. `AGENTS.md` at the repository root is the short form of this page, for coding agents.

## What this is

**Mandala** is a desktop app for markdown notes that dissolve unless you keep them.

- It runs on macOS and Windows.
- It works directly on a vault folder of plain markdown (an Obsidian vault, say).
- Notes come in from elsewhere: Obsidian on a phone, another editor, any sync tool. There is no Mandala phone app and no server.

Every new note is **sand** with a lifespan: a draft. A note becomes **stone** only when someone deliberately keeps it. Mandala only runs when it is open, so opening it is when time catches up: what ran out while it was closed settles, and one message says so.

Stack: a Rust core (`crates/mandala-core`), a Tauri 2 shell (`src-tauri`), and a Svelte 5 window with a CodeMirror 6 live-preview editor (`src/`). No AI, no network, no accounts. The website (`site/`) is Astro 7.4 and holds these docs.

## The one idea

**The folder is the lifespan, and the core owns every rule.**

- `stone/` is kept. `sand/breath/`, `sand/sun/` and `sand/moon/quarter|half|full/` are lifespans.
  - Moving a file between them, in Mandala or in Obsidian on the phone, changes its lifespan.
  - Nothing is written into notes: no frontmatter, ever.
- Times live in `.mandala/life.json`, inside the vault. Obsidian hides it, and it syncs with the vault.
- What must not sync (the last version of each note seen) lives in the state folder, outside the vault (Application Support on macOS).
- `mandala-core` decides everything about notes, with a test for each rule. `src-tauri` only forwards commands. Svelte only shows and asks.

## The standard

Mandala is meant to be beautiful and calm. Read `site/docs/design.md` before you change anything a person sees.

- **Nothing changes from one frame to the next.** What appears, goes, opens or moves does so over a moment, with the motion tokens in `src/app.css`. A jump is a bug.
- **Inner mirrors outer.** Stone on the left, sand on the right, the page between. New layouts keep the symmetry.
- **Words are few.** Say what to do once. No line repeats what the control already shows.
- **No line ends with one or two words.** Shorten the words (rarely lengthen them) until it does not.
- **Look before you say it is done.** Run `node scripts/screens.cjs` and look at the pictures, a narrow window too.
- **What looks wrong is a bug,** whatever the cause.

## Rules that hold everywhere

Each one exists because breaking it loses a note or confuses the person.

- **Nothing is swept while Mandala is closed.**
  - Timed sand that runs out while Mandala is open is swept the moment it runs out (`sweep_ran_out`), even when its window is not in front. It settles for a day, and search and the mandala view can restore it.
  - Sand that ran out while Mandala was closed settles at the next arrival, once sync is done. One message names what left, with Restore.
  - Breaths settle at the close. The next arrival names them in the same message.
- **Never sweep from a stale view.** Arrival and `sweep_ran_out` both wait until `pending_downloads()` is 0. So a note edited on the phone is never swept for an old timestamp.
- **Nothing is deleted outright.** A swept note and a note let go both `settle`: the note leaves the vault at once and rests in `.mandala/settling/` for 24 hours.
  - Only `purge` removes, and only after a day.
  - There is no trash view. Settled notes are found by search, the undo message, or the dust in the mandala view.
- **Every write goes through `fsx::write_atomic`** (temp file, then rename). Sync tools and Obsidian must never see half a note.
- **Never name a file `Name 2.md`.** Sync tools name their copies that way, and `copies.rs` looks for such names. Use `fsx::unique_path` (`Name (1).md`).
- **Lifespans only extend when the person chooses it in Mandala.**
  - A move Mandala did not ask for (Obsidian on the phone), or a shorter lifespan, goes through `Grain::relife`. It never ends later.
  - A longer lifespan chosen in Mandala goes through `Grain::restart`: the clock starts over, and `written` stays.
- **`Elsewhere` notes are never swept.** Anything outside `stone/` and `sand/` is left alone.
- **A path from the window is untrusted.** Every relative path goes through `Vault::path`, which refuses `..` and absolute paths.
- **Adding a command touches four files:** `src-tauri/src/main.rs`, `src/lib/api.ts`, `src/lib/types.ts`, and `src/lib/mock.ts` (so the screen still works in the browser).
- **One kind of button:** `.pill`, an icon before its word (`Icon.svelte`). Icons are stroke SVGs, never emoji.
- **No network.** Fonts are bundled (`@fontsource-variable/*`). The app makes no requests, and neither does the site.

## Before you edit, read

| You are about to touch | Read first |
|---|---|
| Anything in `crates/mandala-core` | `site/docs/vault.md` |
| `visit.rs`, `src/screens/Opening.svelte` | `site/docs/product.md` (Opening and closing) |
| `copies.rs`, `combine.rs`, `Combine.svelte` | `site/docs/combine.md` |
| `src/editor/*`, `Editor.svelte` | `site/docs/editor.md` |
| Any screen, component, color, spacing or motion | `site/docs/design.md` |
| The website in `site/` | `site/README.md` |
| Making a version | `site/docs/release.md` |
| Deciding what to build next | `site/docs/roadmap.md` and the GitHub issues |

## Layout

```
crates/mandala-core/     every rule about notes, tested
  src/lifespan.rs          Life, Place, place_of: the folder is the lifespan
  src/clock.rs             life.json: Grain (written, dissolves), visits
  src/vault.rs             Vault: paths, notes, read/write, reconcile
  src/visit.rs             arrive, let_go, sweep_ran_out, breaths, close
  src/settle.rs            settle, restore, purge: the 24-hour rest
  src/keep.rs              new_sand, set_life, keep, return_to_sand, delete
  src/arrange.rs           turning an Obsidian vault into a mandala, in place
  src/carve.rs             why a stone note is kept (.mandala/carved.json)
  src/attach.rs            pictures: find by name, save into the attachment folder
  src/order.rs             the stone rail's order, set by dragging (.mandala/order.json)
  src/copies.rs            sync copies (any tool): plain notes; sand copies keep their clock
  src/combine.rs           weave and combine two notes, by holding one on the other
  src/rename.rs            a note's file name follows its first heading, links and all
  src/mandala.rs           the mandala view's picture of the vault
  src/links.rs search.rs   [[wikilinks]], backlinks, search
  src/fsx.rs               write_atomic, unique_path, move_file
src-tauri/               Tauri commands, file watcher, close-requested
src/                     the window (Svelte 5)
  lib/api.ts mock.ts       commands, and their browser stand-in
  lib/crumble.ts           text crumbling into sand, when a note is let go
  lib/title.ts             the title field: the first heading, out of the editor
  lib/leaving.ts           the last save and rename before the window leaves the vault
  lib/reveal.ts            the rails find the open note
  lib/flight.ts            a kept note's row glides from the sand rail to the stone rail
  lib/tips.ts              drawing tips: pen, brush, highlighter, pencil
  lib/timer.svelte.ts      the hourglass, a pomodoro timer
  editor/                  CodeMirror: livePreview, theme, pictures
  editor/format.ts         formatting keys: bold, italic, code, strikethrough, links
  editor/find.ts           find in note
  editor/wikilinks.ts      [[ autocomplete from note titles
  editor/tables.ts         tables drawn and edited as tables
  editor/tasks.ts          done tasks sink below open ones
  components/ screens/     rails, keep dialog, search; choose, arrange, opening, main
site/                    the website: home page, teaser, docs explorer
  docs/                    these docs: how each part works and why
scripts/screens.cjs      screenshots of every screen into shots/
scripts/sample-vault.sh  a throwaway Obsidian-like vault to try things on
scripts/drift-soon.sh    a note that runs out in a few seconds, to watch sand let go
scripts/logo.mjs         draws the logo and the app icon's source
docs/logo.svg            the logo
docs/logo.gif            the README's moving logo
```

## Running and testing

The app needs Rust (tested with 1.99) and Node 20 or later (tested with 23). On macOS, it also needs the Xcode command line tools. Run these commands from the repository root:

```
npm install
npm run dev
npm run app
cargo test -p mandala-core
npm test
npm run check
node scripts/screens.cjs
```

- `npm run dev` shows the window in a browser, on the mock (port 1420).
- `npm run app` runs the real app.
- `node scripts/screens.cjs` takes screenshots while the dev server runs.
- To try the real app on a sample vault, run `MANDALA_VAULT=<path> npm run app` with a path from `scripts/sample-vault.sh`. The app does not remember that vault.

Before you say work is done, run `cargo test -p mandala-core`, `cargo clippy --workspace`, `npm run check` and `npm test`. For anything visible, take screenshots and look at them. For the site, run `npm test` and `npm run build` in `site/`.

Never point a test or an experiment at the real vault. Use `scripts/sample-vault.sh`, which makes a copy-shaped vault in a temp folder.

## Writing things down

- How a part works, a trap, or a fact learned about a sync tool, Obsidian, Tauri or CodeMirror goes in that part's file under `site/docs/`.
- A new file there needs a place in `site/src/lib/docs.ts`, or the site does not build.
- `AGENTS.md` gets a line only for a rule every session must follow, or a new row in its table.
- Write what is so now, and why. Do not record what the code already says.
