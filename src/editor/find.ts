// Find in note (⌘F): every match marked in the text, one of them current.
// The bar that asks is `FindBar.svelte`; this holds the matches.
import { StateEffect, StateField, type EditorState } from '@codemirror/state';
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view';

export interface Match {
  from: number;
  to: number;
}

/** Every place `query` occurs in `text`, ignoring case, as plain text. */
export function findAll(text: string, query: string): Match[] {
  if (!query) return [];
  const hay = text.toLowerCase();
  const needle = query.toLowerCase();
  const out: Match[] = [];
  for (let at = hay.indexOf(needle); at !== -1; at = hay.indexOf(needle, at + needle.length)) {
    out.push({ from: at, to: at + needle.length });
  }
  return out;
}

/** The first match at or after `pos`, wrapping to the first; -1 if none. */
export function nearest(matches: Match[], pos: number): number {
  if (!matches.length) return -1;
  const i = matches.findIndex((m) => m.from >= pos);
  return i === -1 ? 0 : i;
}

interface Found {
  query: string;
  matches: Match[];
  current: number;
}

const setFind = StateEffect.define<{ query: string; current: number } | null>();
const none: Found = { query: '', matches: [], current: -1 };

const found = StateField.define<Found>({
  create: () => none,
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(setFind)) {
        if (!e.value) return none;
        return { query: e.value.query, matches: findAll(tr.state.doc.toString(), e.value.query), current: e.value.current };
      }
    }
    if (!tr.docChanged || !value.query) return value;
    // The text changed while finding: look again, and keep the current one near where it was.
    const at = value.matches[value.current] ? tr.changes.mapPos(value.matches[value.current].from) : 0;
    const matches = findAll(tr.state.doc.toString(), value.query);
    return { ...value, matches, current: nearest(matches, at) };
  },
  provide: (f) =>
    EditorView.decorations.from(f, (v): DecorationSet =>
      Decoration.set(v.matches.map((m, i) => (i === v.current ? now : mark).range(m.from, m.to))),
    ),
});

const mark = Decoration.mark({ class: 'cm-found' });
const now = Decoration.mark({ class: 'cm-found cm-found-now' });

export const findField = found;

/** How many matches, and which is current (1-based; 0 when none). */
export function findCount(state: EditorState): { at: number; of: number } {
  const v = state.field(found, false) ?? none;
  return { at: v.current + 1, of: v.matches.length };
}

function show(view: EditorView, query: string, current: number) {
  const matches = findAll(view.state.doc.toString(), query);
  const m = matches[current];
  view.dispatch({ effects: [setFind.of({ query, current }), ...(m ? [EditorView.scrollIntoView(m.from, { y: 'center' })] : [])] });
}

/** Find `query`, from the caret on. */
export function find(view: EditorView, query: string) {
  show(view, query, nearest(findAll(view.state.doc.toString(), query), view.state.selection.main.from));
}

/** Move to the next match (or the one before), wrapping round. */
export function step(view: EditorView, by: 1 | -1) {
  const v = view.state.field(found, false);
  if (!v || !v.matches.length) return;
  show(view, v.query, (v.current + by + v.matches.length) % v.matches.length);
}

/** Stop finding. With `select`, the current match becomes the selection. */
export function endFind(view: EditorView, select: boolean) {
  const v = view.state.field(found, false);
  const m = v?.matches[v.current];
  view.dispatch({ effects: setFind.of(null), ...(select && m ? { selection: { anchor: m.from, head: m.to } } : {}) });
}
