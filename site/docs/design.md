# Design

## The feeling

A sand mandala is built grain by grain and swept away when it is finished.
Mandala should feel like that:

- Patient while you write.
- Honest that things end.
- Deliberate at the few decisions that matter: keeping and letting go.

Mandala has one theme, and it is dark. This is a choice, not a gap.
A dark page is calm and easy on the eyes over a long sitting.
Nothing bright pulls at you, and the words are what glows.

## The window

Inner mirrors outer: stone on the left, sand on the right, the page between.
Where two things are compared (what came in, arranging), stone sits left, sand right, the result in the middle.

### The title bar

- The hourglass at the left (`Hourglass.svelte`).
  - A click turns it. A faint pause button after the minutes pauses it, and the bells wait.
  - A hold opens its settings: work and rest minutes, volume, and Test.
- The glyph and the vault's name in the middle, then the open note's folders. The name changes the vault (⌘O); the visit closes first, through the closing screen.
- At the right: Mandala (⌘M), Search (⌘P), the help card (`?`), and the two pane toggles (stone ⌘[, sand ⌘]).
- In a narrow window it gives way in steps.
  - Below 1100 px the shortcut labels hide; the help card still lists them.
  - Below 900 px the note's folders hide.
  - When the vault's name no longer fits between the hourglass and the actions, it fades.
- Off a Mac the system keeps its own title bar, so no room is kept for window buttons (`html[data-os]`). There is no menu bar there: the window handles every shortcut.

### The rails

- Each rail is 260 px. Its pane toggle slides it out toward its edge. Which rails show is kept in localStorage.
- The stone rail groups notes by folder. Folders collapse; the closed set is kept in localStorage.
- The sand rail starts with **New note**, a sand pill. A click opens a menu of the five lifespans, with none chosen for you; a held press on one makes the note.
- The sand rail lists sand soonest to leave first, so it is not reordered by hand.
- A stone note dropped anywhere on the sand rail returns to sand. While stone is lifted, the rail is tinted sand and says "Drop to return to sand". The lifespan card asks how long it lasts.
- The rails find the open note, however it was opened (search, a link, the mandala view, a new note). Its row scrolls into view, a closed folder holding it opens, and if it had to be found, it glows once in its rail's color (`lib/reveal.ts`). A hidden or faded rail stays as it is.
- Below 900 px both rails hide and the page stays.

### The page

- One centred column: 680 px, or 800 px when the page is at least 960 px wide.
- The note's header (`NoteHead.svelte`).
  - Sand: its life ring and time left, then the five lifespans with its own lit. A held press on another lifespan changes it (one second, as Let go): a shorter one ends no later than before, a longer one starts the clock over.
  - Stone: its carving (`Carving.svelte`), a chisel and the reason it is kept, in italic serif. With no reason the chisel is faint; a click turns it into a field.
  - Then the table button, the paintbrush (⌘D), Let go, and on sand, Set in stone (⌘↵).
- The title, in its own field drawn as the page's heading. Finishing it renames the note's file. A note with no heading (from Obsidian) shows its file name there as its title, and the title renames the file.
- The note itself: live preview, find (⌘F), links, code, tables and pictures. See `site/docs/editor.md`.
- "Linked from" below the note: the notes that link to it, as pills.
- The undo message at the foot of the page, with Restore, for eight seconds.

### Focus

⌘\ fades everything but the note.

- The title bar, both rails, the note's header and "Linked from" fade out. The rails also slide away, and the column widens to 800 px.
- A faded part comes back when the pointer reaches it. A thin strip at each window edge brings back its rail.
- It fades again when the pointer returns to the note, or when writing goes on.
- ⌘\ again ends focus.

## Over the page

Sheets and cards lie over the page on a dimmed, blurred ground. The page stays as it was beneath.

- **The keep card** (`KeepDialog.svelte`): calm and short.
  - A small picture of sand becoming stone, the note's title, and "into" its stone folder.
  - The reason field, whose placeholder asks "Why keep this one?". A reason is optional.
  - The ring, held for three seconds; then "Stay sand" to leave.
- **The drawing sheet** (`Draw.svelte`).
  - Four tips (pen, brush, highlighter, pencil), four inks and any other color, the size, the sheet color, the eraser.
  - On a saved drawing, a held "Let go"; then Cancel and Done.
  - The tools wrap onto a second line in a narrow page, and the sheet shrinks to leave them room.
- **The combine sheet** (`Combine.svelte`): the two notes, named with a stone and a sand dot; three ways to put them together (Woven, First, Last); and the combined page, each note's lines marked faintly in its dot's color. See `site/docs/combine.md`.
- **The table picker** (`TablePicker.svelte`): a 6 by 6 grid under the table button. Its top row, in stone, is the header; the rows below, in sand, are the table's rows.
- **Search** (⌘P) finds notes, and notes let go of in the last day, which it can restore. Each hit has a small tag beside its title: Stone, or Sand with its lifespan icon (`lib/place.ts`); a note outside the mandala has none.
- **The help card**: the shortcuts, then one line with an icon for each thing Mandala does. No how-to: the controls show what to hold or drag.
- **The lifespan card** (`LifePicker.svelte`): the five lifespans, with none chosen.
  - It opens for a new note (⌘N, or New note on an empty page) and for a stone note dropped on the sand rail.
  - A held press (or Enter held on the focused one) chooses. For a new note, the number keys 1 to 5 choose too, and each lifespan shows its number. Esc or a click outside cancels.
- **The mandala view** (⌘M): stone as a lotus, sand drifting outward, links between notes.
  - Dust past the rim is what was let go today. A touch opens a card with its title, when it left, and its text.
  - Restore there is a hold. Back, Esc or a click outside closes the card.

## Acting

- **The pill** is the only button: rounded, an icon before its word.
  - Variants: plain, `.stone` (keeping), `.sand` (sand actions, restoring), `.large` (one primary action on a screen).
  - Icon-only controls (the paintbrush, the pane toggles) are the one exception, each with a label.
- **Icons** are stroke SVGs at 16 units, in `Icon.svelte`. Never emoji.
- **Hold to act.** What keeps or lets go of a note is a press held for one second (`use:hold`).
  - The control fills from the left in its own color, and drains back if let go early. A plain click does nothing.
  - The one other use of a hold: the second action of a control whose click already acts (the hourglass's settings).
  - A control that only moves on, such as Continue, is a plain click.
- **Keeping** is the longest hold: one second opens the keep card, then three seconds on its ring.
  - The note's rune (`lib/rune.ts`, from the reason or else the name) glows in as the ring fills.
  - Full, a solid stroke paints the rune on from left to right, and it sets with a swell of light. The same rune marks the carving.
  - Strokes are never drawn as growing dashes: a round cap on a zero-length dash draws a stray dot.
- **Drag to arrange** (`lib/drag.svelte.ts`, by pointer, not HTML5 drag and drop).
  - In the stone rail: reorder, or drop on another folder to move there.
  - Stone onto the sand rail returns it to sand, once a lifespan is chosen.
  - Sand onto the stone rail opens the keep card with that folder chosen.
  - Rest a note on another for half a second and it glows: drop it there to combine the two.
  - The lifted note dims, a line shows where it lands, and lists move with `animate:flip`.

## Motion

Everything that appears, goes, opens or moves does so over a moment. A jump is a bug.
Use the tokens: `--quick` (160 ms) for hovers, `--settle` (420 ms) for arrivals, `--breath` (4 s) for the opening. `--ease` runs into place and stops, with no crawl at the end.
With `prefers-reduced-motion`, the tokens become 1 ms.

| Moment | Motion |
|---|---|
| Arrive | The ring breathes in and out over 4 s; the petals turn a few degrees. |
| Open | A held Open on "What's leaving": the cards spread their letters and blur (900 ms), 80 ms apart up to the eleventh; the title and the button fade with them (600 ms). |
| The main window | It fades in over `--settle` once its first note is open, so empty rails never flash. |
| Leaving soon | The note opens under a fall of sand (`SandFall.svelte`). Drag across it like a broom, or hold Sweep. It clears once 80% is swept, and stays clear for the visit. It follows the page as rails open and shut. |
| Keep | The rune paints on and sets (950 ms). Then the note's row lifts out of the sand rail as a card and glides to its stone folder, from sand to stone (700 ms, `lib/flight.ts`). Nothing flies when a rail is hidden or faded, or the folder is closed. |
| Let go, and sand that runs out | The open page crumbles into grains (`lib/crumble.ts`) that a soft wind carries right (about 2.2 s). The row stays until the sand has mostly blown (1.5 s), then the rows below close up (600 ms). Refreshes wait meanwhile, so the row never jumps early. |
| Close | The breaths blur and fade as at Open, and the title and the buttons with them. |

The rails get no sand when a note crumbles. In the app's WebKit, a row in a scrolled rail is not repainted while a canvas animates above it, so its card stayed drawn while the sand blew.

## Tokens (`src/app.css`)

| Token | Value | Use |
|---|---|---|
| `--ground` | `#141317` | the page |
| `--night` | `#0e0d10` | opening and closing |
| `--rail` | `#17161a` | rails, title bar |
| `--raised` | `#18171b` | cards, sheets, code blocks |
| `--line` | `#2c2a31` | every border |
| `--bone` | `#ece6da` | text |
| `--ash` | `#a29c92` | secondary text (6.6:1 on ground) |
| `--dust` | `#8a847b` | tertiary text (4.9:1, the floor for small text) |
| `--sand` | `#d9ae6c` | sand, links, the caret |
| `--stone` | `#a9bcc6` | stone, keeping |
| `--vermilion` | `#d9653f` | sand leaving soon (under a quarter of the shared scale, about four hours); errors |
| `--life-breath`, `--life-sun`, `--life-moon` | `#8db4e8`, `#ebc65a`, `#c9c4bb` | lifespan icons only |
| `--lapis`, `--jade` | `#5b82cf`, `#5aae88` | grains in the mandala view only |

- No new color without a reason written here. No text below `--dust`.
- Cards are `--raised` with a `--line` border and a 14 to 16 px radius.
- Scrollbars are thin: a `--line` thumb, no track, `--line-strong` on hover.

## Type

- **Newsreader** (serif) for what was written: note text 19/1.65, titles 40, screen headings 36 to 44.
- **Geist** (sans) for the window: 13 px; labels 12; eyebrows 11, uppercase, 0.14em tracking.
- **Geist Mono** for time, paths, keys and code: 11 to 12 px.
- All three are bundled. Nothing loads from the network.
- Zoom (⌘+, ⌘−, ⌘0) sizes the whole window from 80% to 160% (`lib/zoom.ts`), kept in localStorage.

## Marks

- **The glyph** (a circle, four petals, a centre) is Mandala's mark inside the window: the choose screen, the title bar, the mandala view.
- **Lifespans** show as icons (`LifeMark.svelte`): a breath is a blue wisp, a sun is gold, a moon is its phase in pale gray. A breath shows "Ephemeral", not a time.
- **The logo** (`docs/logo.svg`, `docs/logo.gif`, and the app icon's `src-tauri/icons/source.svg`) is the mandala view in small: a stone lotus, sand drifting out with one grain in vermilion, the rim and its ticks. `scripts/logo.mjs` draws them all.

## Accessibility

- Real `<button>`s, a label on every field, `aria-label` on icon-only controls.
- `role="dialog"` with `aria-modal` on dialogs, `role="status"` on the undo message.
- Text contrast at least 4.5:1.
- `npm run check` reports accessibility warnings. There should be none.

## Words

Few, plain, and in Mandala's voice: sand, stone, a sun, let go, keep, settle.
Never "trash", "archive", "expire" or "TTL". Say what to do once.
