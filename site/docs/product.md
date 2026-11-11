# Product

Mandala is a minimalist markdown notes app built around impermanence. It is Obsidian's file model with one change: **every note begins as sand and will dissolve, unless you keep it.**

## In short

- **Write.** A new note is sand. It has a lifespan, from a breath to a full moon.
- **Keep what matters.** Hold a note to set it in stone, with a reason if you like. Stone stays.
- **Let the rest go.** When its time runs out, sand is swept. It can still be restored for a day.
- **Open Mandala to let time catch up.** Nothing happens while Mandala is closed. When you open it, what ran out settles, and one message says how many left, with Restore.

## Words

| Word | Means |
|---|---|
| **Sand** | A note with a lifespan, in `sand/`. Everything new is sand. |
| **Stone** | A kept note, in `stone/`. It never dissolves. |
| **Lifespan** | How long sand lasts: a breath, a sun, or a quarter, half or full moon. |
| **Keep / set in stone** | Move a sand note into stone, deliberately: a three-second hold and an optional reason. |
| **Let go** | A note leaving because the person held Let go. |
| **Sweep** | A note leaving because its time ran out. |
| **Settling** | The 24 hours after a note leaves, when it can still be restored. Never shown as a folder. |
| **Visit** | One session of Mandala, from opening to closing. |
| **Arrival** | The start of a visit, when time catches up. |

## Lifespans

| Lifespan | Lasts | Folder |
|---|---|---|
| A breath | until the end of the visit in which Mandala first sees it | `sand/breath/` |
| A sun | 24 hours | `sand/sun/` |
| A quarter moon | 7.4 days | `sand/moon/quarter/` |
| A half moon | 14.8 days | `sand/moon/half/` |
| A full moon | 29.5 days (one synodic month) | `sand/moon/full/` |

- Timed lifespans count from when the note was **written**, not from when Mandala first saw it. A note written on the phone on Monday is a Monday note.
- A breath has no clock.
  - Written in Mandala, it leaves when you close.
  - Written on the phone, it leaves when your next visit ends.
- Timed sand that runs out while Mandala is open is swept at that moment, even when its window is not in front. If the note is open, its page crumbles into sand. Its row leaves the rail, and a message offers Restore.
- In Mandala, change a note's lifespan from the five in its header. A shorter one can only make the note end sooner. A longer one, or its own again, starts its clock over.
- Moved anywhere else (in Obsidian on the phone, say), a note can only end sooner.
- A loose note directly in `sand/` (or in an unknown subfolder) is a sun. One directly in `sand/moon/` is a full moon.

## Opening and closing

While Mandala is closed, nothing happens to notes. Opening is when time catches up, with no screens:

- **Opening** waits until sync has brought every note down, so nothing is swept from an old view. This is usually instant; a small turning glyph shows only if it is not.
- Then the sand that ran out while Mandala was closed settles.
- If notes left since your last visit, one message at the foot of the page says how many, for eight seconds: "3 notes left while you were away". **Restore** brings all of them back. Search (⌘P) restores one at a time.
- **Closing** (window close or ⌘Q) saves, then quits. Breaths settle as Mandala closes, and the next opening names them in its message.

## First open

A vault that is not arranged yet opens on the arrange screen. Each top-level folder has a checkbox, all checked at first.

- Checked folders move into `stone/`.
- Unchecked folders stay where they are, outside the mandala. They are never swept, and Obsidian sees them as before.

Mandala takes a snapshot of the whole vault first.

## File names

You never have to think about file names. Write. A note's title sits in its own field above the note. Its file takes that name as soon as you finish the title: Enter, a click into the note, or leaving it.

- The title is the note's first `# heading` on disk, but you never see or change the `#`. A heading typed in the note is just a heading in the note.
- Clear the title and the file keeps its name, which shows faintly in the field. Nothing is ever called "Untitled".
- Every link to the note follows it, as in Obsidian: `[[links]]` with their aliases and headings, embeds, and markdown links.
- Two notes with the same title are told apart: "Rain", then "Rain (1)", "Rain (2)".
- A message says what was renamed, with Undo. Undo puts back both the title and the name you had.
- A name you choose yourself, different from the heading (in Obsidian on the phone, say), is yours. Mandala never changes it. To hand the name back, make it match the heading again.
- A note made in Mandala gets a heading for its title. A note from elsewhere with no heading shows its file name as its title, as Obsidian does. Change it, and the file is renamed, links and all. Mandala does not add a heading to it.

A rename waits in these cases, and a quiet message says why:

- Sync still has notes to bring down.
- A note that links here was changed elsewhere in the last minute (on the phone, say).
- A note outside the mandala links here.

Mandala tries again the next time you finish the title or leave the note.

## Keeping

- Only sand can be kept. Keeping moves the note to `stone/<folder>/` and records the reason in `.mandala/kept.jsonl`, never in the note.
- The reason shows as a **carving** above the stone note. Click it to change it. A stone note with no reason (arranged, or kept on the phone) shows a faint chisel; click to carve one.
- In Mandala: hold **Set in stone** to open the dialog. Hold the ring (or ⌘↵) for three seconds: the note's rune, made from the reason, glows in and brightens, then is painted on. Let go early and the glow fades back.
- On the phone: move the note into `stone/` in Obsidian. It is kept, with no reason. Its faint chisel waits for a reason, whenever you like.
- Stone can return to sand: drag it onto the sand rail and choose a lifespan. Its clock starts then.

## Letting go and restoring

A held **Let go** (or ⌥⌘⌫, held) crumbles the open note's page into sand that blows away; then its row leaves the rail. Neither is final. The note leaves the vault at once (so it disappears from Obsidian too) and settles for 24 hours in `.mandala/settling/`. It can be restored from:

- the message that follows a let go, or the one on opening, with **Restore**,
- **search** (⌘P), where settled notes show faintly with **Restore**,
- the **dust** past the mandala's rim (⌘M): touch it, then hold Restore.

A swept note settles in the same way. Restored sand starts its lifespan again. After a day only the title and dates remain, in `.mandala/swept.log`.

## The phone

There is no Mandala phone app, and nothing is swept while Mandala is closed. How you use your phone depends on how you work: Mandala only needs the vault to be a folder of markdown that reaches the computer.

We recommend the Obsidian app on the phone, with the sync service that you prefer. Mandala's folders are plain Obsidian folders, so the phone needs no plugin:

- A new note goes where Obsidian's "Default location for new notes" says. Mandala leaves that setting to you: pick a sand folder there, or move notes yourself.
- A note outside `sand/` and `stone/` is never swept, until you move it into sand.
- Moving a note between sand folders changes its lifespan.
- Moving a note into `stone/` keeps it.
- Deleting a note in Obsidian lets it go.

Keep the vault's files on the computer. Some sync services save space by keeping a file only in the cloud until you open it. Turn this off for the vault folder.

## Not in Mandala

Plugins, Canvas, the Properties editor, Bases or Dataview queries. Open the vault in Obsidian for those. Mandala ignores frontmatter it finds and never writes any.

There is no light theme. Mandala is dark on purpose: it is calm, easy on the eyes over a long sitting, and lets the words glow.
