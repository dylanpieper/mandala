# The editor

CodeMirror 6 with markdown, made to read like Obsidian's live preview.

- `src/editor/setup.ts` assembles it.
- `livePreview.ts` draws markdown as it reads.
- `theme.ts` holds the fonts, sizes and colors.
- `src/components/Editor.svelte` holds it in the window.

## Live preview

Markdown is drawn as it reads. Its syntax shows only while the editor has focus:

- The marks of bold, italic, strikethrough and inline code show only for the span the caret is in or touching, as in Obsidian.
- All other syntax shows on the lines that hold the caret or a selection.

| Markdown | Drawn as | Syntax hidden off the caret's line |
|---|---|---|
| `# Heading` (1–6) | larger serif line (`.cm-h1`…) | `# ` |
| `*em*`, `**strong**`, `~~strike~~` | italic, semibold, struck | the marks |
| `` `code` `` | mono on a raised ground | the backticks |
| `[text](url)`, bare `https://…`, `www.…` | sand, dotted underline | `[`, `](url)` |
| `[[Note]]`, `[[Note\|alias]]`, `![[embed]]` | sand, dotted underline | `[[`, `]]`, and `Note\|` before an alias |
| `![[picture.png]]`, `![alt](attachments/a.png)` | the picture (`pictures.ts`) | the whole embed |
| `> quote` | italic, a line on the left | `> ` |
| `- [ ] task` | a checkbox; click toggles `[ ]`⇄`[x]`, and done tasks sink below open ones in their list (`tasks.ts`) | `- [ ]` |
| `---` | a rule line | — |

A click on a drawn link opens it.

- A `[[link]]` opens the note with that name (`onFollowLink`).
- A web or mail link opens in the default app (`openLink`, through the Tauri opener plugin).

On the line being edited, a click places the caret. Use ⌘-click there to follow a link.

## Rules

- Decorations are rebuilt on document, selection, viewport and focus changes. Never on a timer.
- Replace decorations (hidden syntax) must not overlap one another. `[[wikilinks]]` are found by pattern first. CommonMark `Link` nodes that overlap them are skipped.
- Loading a different note uses `EditorHandle.load`. It gives the editor a new state, so it is not an edit, it does not save, and it cannot be undone.
- Saving is the window's job (`Main.svelte`): 400 ms after typing stops, and always before switching notes or closing.

## Undo (`history.ts`)

⌘Z and ⇧⌘Z undo and redo in the note (Ctrl+Z and Ctrl+Y off a Mac).
This includes typing, formatting, lists, tables and embeds.

- One editor shows every note. Each note keeps its own history until Mandala closes.
  - When another note opens, the editor's state is put aside under the note's path.
  - When the note opens again with the same text, its state comes back: its history and its caret.
  - When its text changed elsewhere meanwhile (on the phone, say), the note opens with no history.
  - A rename takes the history with it (`rekey`).
- ⌘Z never reaches another note.
- History is CodeMirror's (`@codemirror/commands` 6.11.1): at least 100 steps, and typing within 500 ms is one step.
- History is kept only in memory. It does not survive closing Mandala.
- The title field has the system's own undo.

What can be undone outside the editor is in `site/docs/product.md`: a rename has Undo in its message, and a note let go or swept can be restored for 24 hours.

## The title (`lib/title.ts`)

A note's title is its first `# heading`. It is edited in a field of its own above the editor (`Main.svelte`). For what the person sees, read "File names" in `site/docs/product.md`.

- The editor holds only the body.
  - `splitNote` takes the heading line out when the note opens.
  - `joinNote` puts it back when the note is saved, exactly as it was if the title did not change.
- The `#` is never shown or edited. A `#` typed in the body makes a heading in the body.
- A cleared title takes the heading line out.
  - If the body itself starts with a `# heading` (the second heading of a woven note), an empty `# ` line stays on top.
  - It reads as no title, so the body's heading never becomes the title or the file's name.
- New sand gets a heading that matches its file name, `(1)` included.
- Finishing the title (Enter, leaving the field, or leaving the note) renames the file to match, links and all. See `rename.rs` and "File names" in `site/docs/vault.md`.
- A note without a heading shows its file name in the field.
  - Finishing the title renames the file with `rename_to`, which waits as a heading rename does.
  - No heading is written. Undo renames the file back.
- Before the app closes or changes vaults, it waits for the rename (`lib/leaving.ts`).

Keys in the title:

- Enter, Tab, or ↓ at the end of the title go into the body.
- ↑ on the body's top row, or Backspace at its very start, go back to the title.

## Code

- Fenced code is one raised block in mono, with faint fence lines.
- The language named after the fence sets the highlighting (`@codemirror/language-data` 6.5.2).
  - Each language loads from the app's bundle the first time a note uses it, never from the network.
  - The colors are the app's own (`highlight` in `theme.ts`).

## Tables (`tables.ts`)

A table is always drawn as a table, with each column's alignment. It is edited as a table: each cell is typed in, and the markdown is written back at every change.

- The widget updates its cells in place (`updateDOM`), so the cell being typed in keeps the caret.
- A table is a block widget, so it comes from a state field, not the live-preview plugin.
- A faint "+" at the right adds a column. One below the table adds a row.
- A small sand × takes out a row or a column. Only the row and the column under the pointer, or with the caret, show one: at the row's left, and above the column. They move with the arrow keys. The header row and a table's last column have none.
- Cells hold plain text.

Keys in a table:

- Tab and Shift+Tab go to the next and previous cell. Tab in the last cell adds a row.
- Enter goes to the cell below. In the bottom row, it adds a row.
- ↑ and ↓ go to the cell above and below, in the same column. Past the header or the bottom row, they leave the table.
- ⌘⇧⌫ takes out the caret's row. In the header row it does nothing.
- Esc leaves the table.
- ⌘Z and ⇧⌘Z undo and redo in the note.

### The table picker (`TablePicker.svelte`)

The table button (a grid, before the paintbrush in the note's header) opens a 6 by 6 grid.

- The top row, in stone, is the header.
- The rows below, in sand, are the table's rows. So 3 × 2 is a header and two rows.
- Hover to choose. Click to put an empty table at the caret.
- The table goes on lines of its own, with a blank line around it. The caret goes into its first header cell.

## Links as you type (`wikilinks.ts`)

Typing `[[` (or `![[`) opens a list of the vault's note titles. The open note is left out.

- Titles that start with what is typed come first.
- Then come titles with a word that starts with it.
- Then come the rest that hold it.

Enter or Tab writes `Title]]`, or only `Title` when `]]` is already there. Esc closes the list.

It is `@codemirror/autocomplete` (6.20.4) with this one source only, so markdown's own HTML-tag completion stays off.

## Formatting keys (`format.ts`)

As in other markdown editors: ⌘B bold, ⌘I italic, ⌘E code, ⌘⇧X strikethrough, ⌘K a `[[link]]`.

- Each key wraps the selection. It unwraps the selection when its marks sit just outside or just inside it.
- With no selection, the marks go in at the caret, with the caret between them. The same key again takes empty marks away.
- Italic is told from bold by the run of `*`: one or three is italic.
  - ⌘I on a bold word makes it bold italic.
  - ⌘I on a bold-italic word takes the italic off.
- ⌘K wraps the selection in `[[ ]]`. With no selection, it puts in `[[]]` and opens the list of note titles.
- Pressed again at the end of the formatted text, a key ends it: the caret hops past the closing marks.
- → steps over a whole closing mark at once (← over an opening one), so leaving bold takes one press. Only marks the syntax tree knows count.
- These keys come before CodeMirror's own.
  - Its ⌘[ and ⌘] (indent) and ⌘I (select syntax) are left out, because the rails and italic use them.
  - Tab still indents. On a list item, it moves the item (see "Lists").
- The title field has no formatting. It is plain text.

## Lists (`lists.ts`)

Bullets (`- `), numbers (`1. `) and tasks (`- [ ] `) work at every level, and they mix.

Wrapped lines:

- The wrapped lines of an item start under its text, not under its marker.
- The marker's width is measured in the editor's font, as it shows.
  - On the caret's line, the raw marker counts.
  - On other lines, a task's checkbox counts.

Keys and typing:

- Enter continues the list with the next marker. Enter on an empty item ends the list or goes up a level.
- Backspace just after a marker takes the marker away.
  Both come from `@codemirror/lang-markdown` 6.5.2 (`markdown()` adds them).
- Tab moves the item, with its children, under the text of the item before it.
  On the first item of a list, Tab does nothing.
- Shift+Tab moves the item back to the level of the item above it.
- Type `1. ` at the start of a bullet item's text to make it a numbered item.
  Type `- ` at the start of a numbered item's text to make it a bullet.

Numbers:

- After you type, delete, paste or move a level, each numbered list that the change touched counts up from its first item.
  - The first number sets the start. Take out the first item, and the next item gets its number.
  - A number that you type stays. The items after it count on from it.
  - A numbered item that starts a list after Tab or Shift+Tab gets 1.
- Each level and each list has its own numbers. A bullet between two numbered items makes two lists.
- Opening a note does not change its numbers. Code blocks are never changed.
- One ⌘Z takes back the change and the new numbers.

## Find in note (`find.ts`, `FindBar.svelte`)

⌘F opens a bar under the note's header, at the right of the note, filled with the selected text.

- Every match is marked faintly, and the current one plainly.
- Case is ignored. The text is plain, not a pattern.
- Enter or ⌘G goes to the next match. Shift+Enter or ⇧⌘G goes to the one before. Both go round in a circle.
- Esc closes the bar and selects the current match in the note.
- Opening another note closes the bar.
- The bar has no height in the page, so the note does not move when it opens.
- It stays under the header as the note scrolls, and never covers the header's tools. Focus does not fade it.
- In a narrow note the field shrinks, and the count stays on one line.

## Pictures (`pictures.ts`)

- A picture embed off the caret's line is replaced by the picture.
- Pictures come from the core as raw bytes (`picture` command) and are kept as blob URLs (`pictureUrl` in `api.ts`).
- A web address is never fetched. It stays as text.
- Paste or drop an image: the core saves it in the attachment folder (`attach.rs`) as `Pasted <date> <time>.png`. The note gets `![[name]]` on a line of its own.
- Every embed, pasted or drawn, is a block of its own (`placeBlock`).
  - A blank line goes before it and after it, so it never joins a paragraph or a table. A line right under a table reads as a row.
  - A caret inside a table moves to after the table.
- Each picture in a note shows a small "Let go" pill on hover (`removeButton`). Held for a second, it lets go of the picture.
  - The embed leaves the text (`unembed`).
  - The file settles for a day (`remove_picture`).

## Drawing (`Draw.svelte`)

Draw (the paintbrush in the note's header, or ⌘D) opens a sheet over the page. Done saves `Drawing <date> <time>.svg` and embeds it where the caret was when the sheet opened (`Editor.svelte` remembers it as focus leaves; from a table cell, after the table).

- Each stroke is one `<path>`, so a click on a drawing opens it again to change.
- A changed drawing gets a new version (`pictureChanged`), so the editor draws it again.

The sheet:

- It is 800 by 500 units, scaled to fit the page and its tools.
- The tools wrap onto a second line in a narrow page.
- The sheet follows the page as rails open and shut.

Colors and size:

- Any pen color: four inks, or the system picker.
- A size from 1 to 24.
- A sheet color, saved as a `<rect data-mandala="ground">` behind the strokes. With none, the drawing is clear.

Four tips (`lib/tips.ts`):

- The pen: round and even.
- The brush: a calligraphy nib held at 45°.
  - It is broad across the nib and thin along it.
  - It tapers in and out at the ends, and grows fuller with a pen's pressure.
  - `perfect-freehand` 1.2.3 draws its outline. It streamlines and smooths the hand's points.
- The highlighter: wide, with flat ends, see-through.
- The pencil: thin and soft.

The file stays plain SVG:

- A brush stroke is a filled outline. The other tips are stroked paths.
- Each `<path>` keeps its tip in `data-tip`, so a drawing opens again with its tips.
- A filled path from elsewhere opens as a brush stroke.

The eraser lifts whole strokes. On a saved drawing, a held "Let go" lets go of it, as for a note.

## Not yet

- Bold, italics and links inside table cells.
- Note embeds (`![[Note]]`) drawn inline.
