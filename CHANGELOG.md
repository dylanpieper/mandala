# Changelog

All notable changes to Mandala. Versions follow [Semantic Versioning](https://semver.org).

## Unreleased

### Opening

- No opening or closing screens. Mandala opens straight to your notes, with a small turning glyph only while sync is slow.
- What ran out while Mandala was closed settles as it opens, and breaths settle as it closes. One message says what left, with Restore. Each note can still be restored for a day.
- Closing quits at once, after the last save.

### The page

- ⌘/ switches between live preview and source view, where every mark shows. Each launch starts in live preview.
- Fixed: find in note (⌘F) covered the note's header tools. It now sits below the header.
- Each note keeps its own undo history until Mandala closes.
- Fixed: ⌘Z on a note just opened brought back the text of the note before it, and saved it there.

### The window

- A menu (☰) at the right of the title bar replaces the help card: every shortcut, as an item to click.
- The hourglass is now in the sand rail's head, so nothing sits beside the window's buttons.
- In the menu, New note, Set in stone, Let go and Change vault are held for a second, each in its own color.
- Hold ⌥⌘⌫ to let go of the open note. A card fills while you hold; release early and nothing happens.

### The site

- The home page is centred: the logo, the line, and the downloads. The teaser is gone.

## 0.2.0 (2026-11-09)

A preview: lifespans front and center, better lists and tables, and a fix for a note that seemed to lose its words.

### Notes

- New note: a sand pill at the top of the sand rail with a menu of the five lifespans, and a lifespan card for ⌘N. Nothing is chosen for you; a held press makes the note.
- The five lifespans sit in the note's header, its own lit. A held press on one changes it; a held press on its own starts its clock over. Each one's title is only its name and time.
- Drag a stone note onto the sand rail to return it to sand, with the lifespan you choose.
- Fixed: after a lifespan change, or a move to another folder, the open note showed the text it had when it was opened. Your words were safe on disk; now the page keeps them too.

### The page

- The note's header stays at the top of the page as the note scrolls.
- Lists: wrapped lines start under the item's text, numbers stay in sequence as items come and go, Tab and Shift+Tab move an item a level, and `1. ` or `- ` typed at the start of an item switches it between number and bullet.
- Tables: take out a row or a column with the small sand × beside it, or the caret's row with ⌘⇧⌫. ⌘Z brings it back. The handles follow the caret, and ↑ and ↓ stay in the column.
- Drawings and pictures never land inside or under a table: they go where the caret was, with a blank line around them.

### The window

- The vault's name in the title bar opens a menu: Show in Finder (or File Explorer), and Open another vault. Cancelling the folder picker keeps your vault, and a vault that fails to open offers the way back.
- Focus: a faded rail wakes when the pointer comes near it, not only at the window's edge.

### The site

- "Notes dissolve into sand / Unless you set them in stone", on the site and in a shorter README.
- The teaser shows the app as it is now. On a phone it opens on the note, plays slower, holds Set in stone on the page, then shows the rails; the loop ends with the closing screen letting a breath go.
- The macOS download is stone and the Windows download is sand, with no arrows.
- Windows is no longer marked untested.

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
