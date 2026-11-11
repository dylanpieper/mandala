# The vault on disk

Read this before changing anything in `crates/mandala-core`.

## Layout

```
<vault>/                         any folder of markdown, often an Obsidian vault, often synced
  stone/…                        kept, any subfolders
  sand/breath/                   a breath
  sand/sun/                      a sun (where Obsidian's new notes go)
  sand/moon/quarter|half|full/   moons
  attachments/                   left where it is; new pictures go here (`attach.rs`)
  .obsidian/                     Obsidian's; Mandala only ever sets two keys in app.json
  .mandala/
    life.json                    the clock (see below)
    settling/<id>/<file>.md      let go or swept, restorable for 24 hours
    settling/<id>/meta.json      { id, rel, title, reason, at }
    kept.jsonl                   one line per keep: { rel, from, at, because, life }
    carved.json                  why each stone note is kept: { path: { text, at, ino } } (`carve.rs`)
    order.json                   the stone rail's order, set by dragging: a list of paths (`order.rs`)
    swept.log                    after a day: time, reason, path. No text from the note.

<state folder>/                  macOS: ~/Library/Application Support/app.mandala.notes/
                                 Windows: %APPDATA%\app.mandala.notes\
  last-vault.txt
  vaults/<vault name>/base/…     the last version of each note Mandala saw: to know sync copies (`copies.rs`)
  snapshots/<date>/              copies taken before arranging
```

Obsidian hides folders that start with a dot, so `.mandala/` (and with it settling) never appears on the phone.

- `.mandala/` is inside the vault on purpose. The clock and settling must travel with the notes.
- The last-seen versions are outside on purpose. They must not sync, or both devices would share one "last seen".

## The clock (`life.json`)

```json
{
  "visit": 12,
  "last_open": "2026-10-31T06:10:00Z",
  "last_close": "2026-10-29T21:40:00Z",
  "grains": {
    "sand/sun/Morning pages.md": {
      "life": "sun",
      "written": "2026-10-31T06:12:00Z",
      "dissolves": "2026-11-01T06:12:00Z",
      "seen_visit": 12,
      "ino": 8812734
    }
  }
}
```

- `Vault::reconcile` rebuilds `grains` from the files. Call `Vault::refresh` whenever the watcher fires.
  - New sand gets `written` from the file's times.
  - Moved sand keeps its clock (followed by inode).
  - Gone sand is forgotten.
- `set_life` is a choice made in Mandala.
  - A shorter lifespan ends no later than before (`relife`).
  - A longer one starts the clock over now (`restart`, which sets `started`).
  - The same one starts the clock over too, and the note does not move.
- A move made in Obsidian goes through `reconcile` and `relife`, so it never extends.
- `written` is always the real creation time. The clock counts from `started` when it is set.
- `life` always equals the folder. `dissolves` is the clock start plus the duration.
  A folder change outside a choice in Mandala goes through `Grain::relife`, so `dissolves` can only get earlier.
- `arrive` begins a visit, before any note is written in it.
  - Once `pending_downloads()` is 0, it settles timed sand that ran out while Mandala was closed, and breaths left from a visit that never closed.
  - `Arrival::left` names those, and the breaths that settled when the last visit closed. The window shows them in one message, with Restore.
  - Breaths of the last close are named only if that visit closed after it opened, so they are named once.
- `sweep_ran_out` sweeps timed sand as it runs out during a visit.
  - It refuses while `pending_downloads()` is above 0.
  - It reconciles first, so a lifespan changed on the phone counts.
  - It never touches breaths, stone or `Elsewhere`.
- `seen_visit` is what makes breaths work. A breath leaves at the close of the visit in which it was first seen.
  If that visit never closed (a crash), the breath settles at the next arrival.

## Traps

- **Files kept only in the cloud.** Mandala does not handle them.
  The vault's files must stay on disk ("The phone" in `product.md`).
  One older placeholder form, `.<name>.md.icloud`, is a dot file, so `notes()` skips it.
  `pending_downloads()` counts these placeholders, and arrival waits for zero.
- **Creation times lie.** A sync tool may set a downloaded file's creation time to the download time.
  `written` is the earliest of creation and modification.
- **Copy naming.** Sync tools name their copies in many ways.
  `copy_of` knows them by name start and shared text (`site/docs/combine.md`).
  Mandala never names a file `Name 2.md` itself (`fsx::unique_path` uses `Name (1).md`), so its own files never look like copies.
- **Atomic writes.** Always use `fsx::write_atomic`. A reader must never see half a file.
  On Windows, a rename onto a file that another program holds open fails for a moment.
  So `write_atomic` tries again for about a second.
- **State is named by folder name.** The window keeps a vault's state in `vaults/<folder name>/`.
  So two vaults with the same folder name share their last-seen versions, and sync copies are judged wrongly in both.
  `scripts/sample-vault.sh` names its vault `Sample` for this reason. Never give a test vault the name of a real one.
- **Paths from the window** go through `Vault::path`, which refuses `..`, absolute paths and empty paths.
- **Inodes** follow a moved file on one disk (`vault::inode`: the inode on a Mac, the file index on Windows).
  The clock and the carvings both use it.
  A move that arrives through sync as delete-and-create gets a fresh clock from the file's times.
  That is still correct for a note the phone just moved, because its modification time is unchanged.

## Arranging an existing vault

`arrange_plan` lists the top-level entries to move under `stone/`: everything except dot folders, `stone`, `sand`, and attachment folders named in `arrange::LEFT_IN_PLACE`. `arrange`:

1. optionally copies the whole vault to a snapshot outside it,
2. makes the sand folders and `.mandala/`,
3. moves each entry under `stone/`,
4. rewrites `[[Folder/Note]]` links to `[[stone/Folder/Note]]` (plain `[[Note]]` links need nothing: Obsidian resolves them by name),
5. optionally sets Obsidian's `newFileLocation: "folder"` and `newFileFolderPath: "sand/sun"`, keeping every other key.

`arrange_plan_only(chosen)` moves only the chosen entries.

- The rest go in `Plan::elsewhere` and stay where they are.
- They are `Place::Elsewhere`, so they are never swept, and Obsidian sees them as before.
- Links into them are not rewritten, because they did not move.

Markdown links written as relative paths (`[x](Folder/Note.md)`) are not rewritten yet.

## Carvings (`carve.rs`)

Why a stone note is kept. Never in the note: in `.mandala/carved.json`, path to `{ text, at, ino }`.

- `keep` writes one when a reason is given.
- `carve(rel, text)` sets, changes or (with empty text) removes one, for stone notes only.
- `move_stone` carries the carving to the new path.
- A note moved or renamed outside Mandala is followed by `ino` the next time carvings are read.
- The first read, with no `carved.json` yet, fills it from `kept.jsonl`.
- Search also matches carvings.

## File names (`rename.rs`)

A note's file name follows its first heading, while the two agree.

- The window calls `follow_heading` with the note's text as it was opened.
  It does this when the title is finished or the note is left (another note opened, a keep, the visit closing).
  The name follows only if it matched that first heading.
  A name that differs from the heading is the person's and is never changed.
- `heading_of` takes the first `# ` line with its markdown marks out.
  `stem_for_heading` makes it a file name, without `[ ] # ^ |` and the characters `file_stem_for` drops.
  A ` (n)` at the end of a name still counts as matching.
- The new name is unique in the whole vault, not only the folder, because Obsidian finds `[[Name]]` anywhere: `Name`, then `Name (1)`, `Name (2)`.
  A change of case only goes through a passing name, for disks that ignore case.
- `rename_note` writes `renaming.json` in the state folder first. Then it:
  - renames in the same folder (the inode stays, so the clock follows),
  - carries the carving and the place in `order.json`,
  - remembers the new text,
  - rewrites links.
- `finish_renames` at open finishes a rename that stopped part-way.
- `relink` rewrites `[[Name]]`, `[[Name|alias]]`, `[[Name#heading]]`, path forms, `![[Name]]`, and `.md` markdown links (relative or from the root, `%20` for spaces), outside fenced code.
  A link whose path means another note is left as it is.
- A rename waits (`Held`) while:
  - `pending_downloads()` is above 0;
  - a linking note changed in the last 60 seconds, and not by Mandala (its text differs from the last-seen copy, which Mandala's own saves update);
  - an `Elsewhere` note links here (Mandala does not write there);
  - another note has the same name, and a link could mean either.
- Undo (in the window) writes the old heading back, then calls `rename_note` back to the old name.
  So heading and name still match and keep following each other.
- `rename_note` alone, with a name that differs from the heading, makes the name the person's from then on.
- A note with no heading (most from Obsidian) has its file name as its title.
  `rename_to(rel, title, now)` renames it to a title typed for it, waiting as `follow_heading` does, and writes no heading.
  Undo is `rename_note` back.

## Pictures (`attach.rs`)

- New pictures go to Obsidian's `attachmentFolderPath` if it names a folder, else the first existing of `LEFT_IN_PLACE`, else `attachments/`.
  Names never collide (`unique_path`).
- An embed names a file, not a path, as in Obsidian.
  `find_picture` looks in the attachment folder first, then anywhere outside dot folders.
- Only picture files (`attach::PICTURES`) are read or written by these commands.
