// Formatting keys, as in other markdown editors: ⌘B bold, ⌘I italic, ⌘E
// code, ⌘⇧X strikethrough, ⌘K a [[link]]. Each wraps the selection, or
// unwraps it if it is wrapped already; with no selection it puts the marks at
// the caret and the caret between them.
import { startCompletion } from '@codemirror/autocomplete';
import { syntaxTree } from '@codemirror/language';
import type { EditorView, KeyBinding } from '@codemirror/view';

/** How many of `ch` run back from `at` (before it) or forward from `at`. */
function run(text: string, at: number, ch: string, back: boolean): number {
  let n = 0;
  if (back) while (at - n - 1 >= 0 && text[at - n - 1] === ch) n++;
  else while (at + n < text.length && text[at + n] === ch) n++;
  return n;
}

/** Whether a run of `n` mark characters holds `mark` (for `*`: italic is in 1 or 3, not 2). */
function holds(n: number, mark: string): boolean {
  if (mark === '*') return n === 1 || n >= 3;
  return n >= mark.length;
}

/** The text with `mark` toggled around `from`…`to`, and where the selection is after. */
export function toggleMark(text: string, from: number, to: number, mark: string): { text: string; from: number; to: number } {
  const m = mark.length;
  const ch = mark[0];
  const repeat = mark === ch.repeat(m);
  // Marks just outside the selection.
  const outside = repeat ? holds(run(text, from, ch, true), mark) && holds(run(text, to, ch, false), mark) : text.slice(from - m, from) === mark && text.slice(to, to + m) === mark;
  if (outside && from - m >= 0) {
    return { text: text.slice(0, from - m) + text.slice(from, to) + text.slice(to + m), from: from - m, to: to - m };
  }
  // The caret at the end of marked text, its closing marks just after it:
  // pressed again, the key ends the formatting by hopping past them.
  const opens = text.lastIndexOf(mark, from - 1);
  if (from === to && opens >= 0 && opens + m < from && text.slice(from, from + m) === mark && (!repeat || holds(run(text, from, ch, false), mark))) {
    return { text, from: from + m, to: from + m };
  }
  // Marks just inside it.
  const inner = text.slice(from, to);
  if (inner.length >= 2 * m && inner.startsWith(mark) && inner.endsWith(mark) && (!repeat || (holds(run(inner, 0, ch, false), mark) && holds(run(inner, inner.length, ch, true), mark)))) {
    return { text: text.slice(0, from) + inner.slice(m, -m) + text.slice(to), from, to: to - 2 * m };
  }
  return { text: text.slice(0, from) + mark + inner + mark + text.slice(to), from: from + m, to: to + m };
}

function toggle(mark: string) {
  return (view: EditorView) => {
    const { from, to } = view.state.selection.main;
    // Only the lines around the selection are looked at and changed.
    const a = view.state.doc.lineAt(from).from;
    const b = view.state.doc.lineAt(to).to;
    const r = toggleMark(view.state.sliceDoc(a, b), from - a, to - a, mark);
    view.dispatch({ changes: { from: a, to: b, insert: r.text }, selection: { anchor: a + r.from, head: a + r.to }, userEvent: 'input.format' });
    return true;
  };
}

/** ⌘K: the selection becomes a `[[link]]`; with none, `[[]]` and the list of note titles. */
function link(view: EditorView) {
  const { from, to } = view.state.selection.main;
  const inner = view.state.sliceDoc(from, to);
  if (inner) {
    view.dispatch({ changes: { from, to, insert: `[[${inner}]]` }, selection: { anchor: from + inner.length + 4 }, userEvent: 'input.format' });
    return true;
  }
  view.dispatch({ changes: { from, insert: '[[]]' }, selection: { anchor: from + 2 }, userEvent: 'input.format' });
  startCompletion(view);
  return true;
}

const MARKS = new Set(['EmphasisMark', 'StrikethroughMark', 'CodeMark']);

/**
 * → just before a closing mark (`**`, `*`, `~~`, a backtick) steps over the
 * whole mark at once, as ← does over an opening one, so leaving bold takes one
 * press. Only marks the syntax tree knows count, never a plain `*`.
 */
function stepOver(forward: boolean) {
  return (view: EditorView) => {
    const sel = view.state.selection.main;
    if (!sel.empty) return false;
    const node = syntaxTree(view.state).resolveInner(sel.head, forward ? 1 : -1);
    if (!MARKS.has(node.name) || !node.parent) return false;
    if (forward && node.from === sel.head && node.to === node.parent.to) {
      view.dispatch({ selection: { anchor: node.to } });
      return true;
    }
    if (!forward && node.to === sel.head && node.from === node.parent.from) {
      view.dispatch({ selection: { anchor: node.from } });
      return true;
    }
    return false;
  };
}

/** The formatting commands by name, for the menu (`lib/menu.ts`). */
export const formats = { bold: toggle('**'), italic: toggle('*'), code: toggle('`'), strike: toggle('~~'), link };
export type Format = keyof typeof formats;

export const formatKeys: KeyBinding[] = [
  { key: 'ArrowRight', run: stepOver(true) },
  { key: 'ArrowLeft', run: stepOver(false) },
  { key: 'Mod-b', run: formats.bold, preventDefault: true },
  { key: 'Mod-i', run: formats.italic, preventDefault: true },
  { key: 'Mod-e', run: formats.code, preventDefault: true },
  { key: 'Mod-Shift-x', run: formats.strike, preventDefault: true },
  { key: 'Mod-k', run: formats.link, preventDefault: true },
];
