# Copies and combining

Two notes become one only when the person chooses: hold one note on another, and drop it.
Until then, copies that sync tools make are plain notes.

## Sync copies (`copies.rs`)

When a note changes on two devices before sync catches up, the sync tool keeps both.
It names the copy its own way (`Note 2.md`, `Note (conflicted copy).md`).
A copy is a plain note: combine it with its note (below), or let it go.

A copy of sand gets no extra life: `reconcile` gives it its note's clock (`Grain::relife`).

`copy_of(rel)` counts a note as a copy when all of these are true:

- it is new to Mandala;
- it sits beside a note that Mandala knows;
- its name starts with that note's name, then a space, `(`, `.`, `-` or `_`;
- it shares at least half its lines (`SHARED`).

What Mandala knows of a note is its base: the last version it saw.
Mandala saves the base at each arrival and each save, in `base/` in the state folder.
The state folder is outside the vault, so the base never syncs.

## Combining (`combine.rs`, `Combine.svelte`)

1. Drag a note over another note in a rail, and rest on its middle for half a second (`ONTO_MS` in `lib/drag.svelte.ts`).
   The note glows (`.drop-onto`). Drop it there.
   Dropping beside a note still reorders.
2. A sheet opens over the page with the two notes already combined (`weave`).
   - **Woven**: lines both notes share appear once. Lines only one has stay where they were, in order.
     Where both have their own lines in the same place, the note dropped on comes first.
     Each note's own lines carry a faint mark in its color.
   - **First** or **Last**: the note dropped on, a blank line, then the other; or the other way round.
     The two names above change places to show the order.
3. A click on the page turns it into text, to change anything.
4. **Combine** writes the text into the note dropped on (`combine`).
   - That note keeps its place, lifespan and name.
   - The dragged note settles for a day (`Reason::Combined`), so the undo message, search and the mandala's dust can restore it.
   - A carving goes with the text when the note dropped on has none.
5. **Cancel** or Esc changes nothing.

`weave` lines the notes up by their longest common run of lines.
Above `MAX_CELLS` line pairs, it skips the lining-up: the note dropped on, then the dragged note's lines that it does not already have.
