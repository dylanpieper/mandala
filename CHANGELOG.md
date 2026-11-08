# Changelog

All notable changes to Mandala. Versions follow [Semantic Versioning](https://semver.org).

## Unreleased

- Drawings and pictures never land inside or under a table: they go where the caret was, with a blank line around them.
- New note: a sand pill at the top of the sand rail with a menu of the five lifespans, and a lifespan card for ⌘N. Nothing is chosen for you; a held press makes the note.
- The five lifespans sit in the note's header: the note's own is lit, and a held press on another changes it.
- Drag a stone note onto the sand rail to return it to sand, with the lifespan you choose.
- The note's header stays at the top of the page as the note scrolls.


## 0.1.0 (2026-11-05)

The first version, a preview.

### Notes

- Every new note is sand, with one of five lifespans: a breath, a sun, or a quarter, half or full moon. The folder is the lifespan.
- Stone is for what you keep. Keeping takes a held press and an optional reason.
- The keep card is calm and short: a small picture of sand becoming stone, the note's title, and a field that asks "Why keep this one?".
- While the ring is held, the note's rune glows in. Then it is painted on.
- A kept note's row lifts out of the sand rail and glides to its stone folder.
- The reason shows as a carving above the stone note. You can change it or add one later.
- File names follow the title, and every link to the note follows the file. Two notes with the same title become "Rain" and "Rain (1)". A message offers Undo.
- Nothing is deleted outright. A note that is let go settles for 24 hours and can be restored.

### Opening and closing

- Opening is a short ritual: arrive while sync catches up, see what came in, let go of what ran out. Only the steps with something to show appear.
- "What's leaving" ends with a held Open. The notes, the title and the button blur and fade, as at closing.
- Notes kept on the phone (moved into `stone/`) show in "What came in" under "Stone · kept", with a chisel to carve a reason.
- Breaths leave at the closing screen.
- The main window fades in once its first note is open.
- First open arranges a vault in place, after a snapshot. You choose which folders become stone. The rest stays outside and is never swept.
- Change the vault from its name in the title bar (⌘O). The visit closes first.

### The page

- A live-preview editor. Links open on a click, and done tasks sort below open ones.
- The title has its own field above the note. A note from Obsidian with no heading shows its file name there.
- Formatting keys as in other markdown editors: ⌘B bold, ⌘I italic, ⌘E code, ⌘⇧X strikethrough, ⌘K a `[[link]]`. The marks show only for the span at the caret. The same key again ends the formatting.
- Typing `[[` opens a list of note titles.
- Find in note (⌘F).
- Code blocks are highlighted by their language.
- Tables are drawn as tables and edited cell by cell. A table button opens a small grid to choose the rows and columns.
- Pictures: paste or drop an image into a note. Or draw on a sheet with a pen, a calligraphy brush, a highlighter or a pencil. Drawings are SVG files that Obsidian shows, and they open again to change.
- A note that leaves soon opens under a fall of sand. Sweep it with the pointer, or hold Sweep (a broom). It clears once 80% is swept.
- Letting go crumbles the page into sand that blows away. Then the rows below close up.
- Sand that runs out while Mandala is open is swept at that moment, with Restore in the message. Sand that ran out while Mandala was closed waits for "What's leaving".

### The window

- The mandala view (⌘M): stone as a lotus, sand drifting outward, links between notes, and the dust of what was let go.
- Focus (`⌘\`) fades everything but the note and widens it to 800 px. A faded part comes back when the pointer reaches it.
- Rails that hide (⌘[ for stone, ⌘] for sand), folders that collapse, and a help card with the shortcuts.
- The rails find the open note, however it was opened, and open its folder.
- Search (⌘P) shows whether each note is stone or sand, with its lifespan.
- An hourglass timer with bells, a pause, and its own settings.
- In a narrow window, the title bar hides its shortcut labels, then the note's folders, then the vault's name.
- A new app icon, drawn to read at small sizes.

### Sync

- Works on any folder of markdown, synced by any tool.
- Combine two notes by holding one on the other. Weave them, or put one after the other, then change the text by hand before it is saved.
- Copies from any sync tool are plain notes. A copy of sand keeps its note's clock.
- Changes from sync come in calmly: one refresh after a quarter second of quiet, and at least one every 2 seconds during a long sync.

### The site

- A website on GitHub Pages: the downloads, a live miniature of the window, and every doc in a calm explorer with offline search.
- An animated logo in the README: sand drifts out from a breathing lotus.
- Mandala is open source under the MIT license.
- The docs live in `site/docs/`. `AGENTS.md` holds the short rules for coding agents, and `CLAUDE.md` points to it.
