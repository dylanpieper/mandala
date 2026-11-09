// Lists: wrapped lines hang under the item's text, numbers stay in sequence,
// Tab and Shift+Tab move an item a level, and `1. ` or `- ` typed at the start
// of an item's text switches its kind. Enter continues a list and Backspace
// takes a marker away (`@codemirror/lang-markdown`, wired by `markdown()`).
// Read site/docs/editor.md before changing this.

import { syntaxTree } from '@codemirror/language';
import { type ChangeSpec, type EditorState, type Line, type Range, EditorState as State, StateEffect, type Transaction } from '@codemirror/state';
import { type Command, Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view';
import { activeLines } from './livePreview';

// Indent, marker (bullet, or number and delimiter), and the spaces after it.
const ITEM = /^( *)([-*+]|(\d{1,9})([.)]))( +|$)/;

function indentOf(line: string): number {
  return line.length - line.trimStart().length;
}

/** The column where an item's text starts: under it go its children. */
function textColumn(m: RegExpExecArray): number {
  const gap = m[5].length;
  return m[1].length + m[2].length + (gap === 0 || gap > 4 ? 1 : gap);
}

/** Bullets with the same character, or numbers with the same delimiter, are one list. */
function kindOf(m: RegExpExecArray): string {
  return m[3] ? `1${m[4]}` : m[2];
}

/** The item at the same indent before line `i`, over children and blank lines; -1 if `i` is first. */
function previousSibling(lines: string[], i: number, indent: number): number {
  for (let k = i - 1; k >= 0; k--) {
    if (lines[k].trim() === '') continue;
    const at = indentOf(lines[k]);
    if (at > indent) continue;
    return at === indent && ITEM.test(lines[k]) ? k : -1;
  }
  return -1;
}

export interface LineEdit {
  line: number;
  from: number;
  to: number;
  insert: string;
}

/**
 * Move list items `first`..`last` (0-based lines) one level in (`1`) or out
 * (`-1`), with their children. In goes under the item before, out goes to the
 * level of the item above. A numbered item that comes to start a list is
 * numbered 1, and so is the next item when it is left starting one. Returns
 * the edits; empty when the item cannot move; null when `first` is no item.
 */
export function moveItems(lines: string[], first: number, last: number, dir: 1 | -1): LineEdit[] | null {
  const head = ITEM.exec(lines[first] ?? '');
  if (!head) return null;
  const indent = head[1].length;

  // The block: the chosen lines and the children of the last.
  let end = last + 1;
  for (let k = end; k < lines.length; k++) {
    if (lines[k].trim() === '') continue;
    if (indentOf(lines[k]) <= indent) break;
    end = k + 1;
  }

  let shift: number;
  if (dir > 0) {
    const sibling = previousSibling(lines, first, indent);
    if (sibling < 0) return [];
    shift = textColumn(ITEM.exec(lines[sibling])!) - indent;
  } else {
    if (indent === 0) return [];
    let target = 0;
    for (let k = first - 1; k >= 0; k--) {
      if (lines[k].trim() === '' || indentOf(lines[k]) >= indent) continue;
      target = ITEM.test(lines[k]) ? indentOf(lines[k]) : 0;
      break;
    }
    shift = target - indent;
  }
  if (shift === 0) return [];

  const edits: LineEdit[] = [];
  const moved = [...lines];
  for (let k = first; k < end; k++) {
    if (lines[k].trim() === '') continue;
    if (shift > 0) {
      edits.push({ line: k, from: 0, to: 0, insert: ' '.repeat(shift) });
      moved[k] = ' '.repeat(shift) + lines[k];
    } else {
      const cut = Math.min(-shift, indentOf(lines[k]));
      edits.push({ line: k, from: 0, to: cut, insert: '' });
      moved[k] = lines[k].slice(cut);
    }
  }

  // A numbered item that now starts a list starts it at 1.
  let next = end;
  while (next < lines.length && lines[next].trim() === '') next++;
  for (const k of [first, next]) {
    const m = ITEM.exec(moved[k] ?? '');
    if (!m || !m[3] || m[3] === '1') continue;
    const prev = previousSibling(moved, k, m[1].length);
    if (prev >= 0 && kindOf(ITEM.exec(moved[prev])!) === kindOf(m)) continue;
    const at = indentOf(lines[k]);
    edits.push({ line: k, from: at, to: at + m[3].length, insert: '1' });
  }
  return edits;
}

/** A list item's own line, as the syntax tree reads it (not a `- ` in code). */
function itemAt(state: EditorState, line: Line): RegExpExecArray | null {
  const m = ITEM.exec(line.text);
  if (!m) return null;
  return syntaxTree(state).resolveInner(line.from + m[1].length, 1).name === 'ListMark' ? m : null;
}

function move(dir: 1 | -1): Command {
  return (view) => {
    const { state } = view;
    const range = state.selection.main;
    const first = state.doc.lineAt(range.from);
    if (!itemAt(state, first)) return false;
    const last = state.doc.lineAt(range.to);
    const edits = moveItems(state.doc.toString().split('\n'), first.number - 1, last.number - 1, dir);
    if (!edits) return false;
    // On an item that cannot move, Tab does nothing: it never indents the line by itself.
    if (edits.length) {
      const changes = edits.map((e) => {
        const from = state.doc.line(e.line + 1).from;
        return { from: from + e.from, to: from + e.to, insert: e.insert };
      });
      view.dispatch({ changes, userEvent: 'input.indent' });
    }
    return true;
  };
}

export const listKeys = [
  { key: 'Tab', run: move(1) },
  { key: 'Shift-Tab', run: move(-1) },
];

/**
 * The numbers to change so each numbered list touched by an edit counts up
 * from its first item. An item whose number was just typed keeps it, and the
 * items after count on from there. `starts` holds the numbers of first items
 * that were taken out, by where their marks were: the item that takes the
 * place keeps the list's start.
 */
export function renumber(state: EditorState, touched: { from: number; to: number }[], typed: { from: number; to: number }[], starts = new Map<number, number>()): ChangeSpec[] {
  const tree = syntaxTree(state);
  const { doc } = state;
  const lists = new Map<number, ReturnType<typeof tree.resolveInner>>();
  for (const r of touched) {
    const from = doc.lineAt(r.from).from;
    const to = doc.lineAt(r.to).to;
    // Not parsed this far yet: leave the numbers as they are.
    if (tree.length < to) continue;
    tree.iterate({
      from,
      to,
      enter: (n) => {
        if (n.name === 'OrderedList') lists.set(n.from, n.node);
      },
    });
  }

  const changes: ChangeSpec[] = [];
  for (const list of lists.values()) {
    let next = -1;
    for (let item = list.firstChild; item; item = item.nextSibling) {
      const mark = item.name === 'ListItem' ? item.getChild('ListMark') : null;
      if (!mark) continue;
      const digits = mark.to - 1;
      const n = parseInt(doc.sliceString(mark.from, digits), 10);
      const justTyped = typed.some((t) => t.from < digits && t.to > mark.from);
      if (next < 0 && starts.has(mark.from) && !justTyped) {
        next = starts.get(mark.from)!;
      } else if (next < 0 || justTyped) {
        next = n + 1;
        continue;
      }
      if (n !== next) changes.push({ from: mark.from, to: digits, insert: String(next) });
      next++;
    }
  }
  return changes;
}

/** Typing, deleting, pasting, dropping or moving a level puts the numbers of the lists it touched in sequence. One undo takes back both. */
export const renumberLists = State.transactionFilter.of((tr: Transaction) => {
  if (!tr.docChanged || !['input', 'delete', 'move'].some((e) => tr.isUserEvent(e))) return tr;
  const touched: { from: number; to: number }[] = [];
  const typed: { from: number; to: number }[] = [];
  const starts = new Map<number, number>();
  const old = tr.startState.doc;
  tr.changes.iterChanges((fromA, toA, from, to, text) => {
    touched.push({ from, to });
    if (/^\d+$/.test(text.toString())) typed.push({ from, to });
    // Items taken out from the start of a line: the one after takes the first one's number.
    const line = old.lineAt(fromA);
    const m = toA > fromA && line.from === fromA ? ITEM.exec(line.text) : null;
    if (m?.[3]) starts.set(to + m[1].length, parseInt(m[3], 10));
  });
  const changes = renumber(tr.state, touched, typed, starts);
  return changes.length ? [tr, { changes, sequential: true }] : tr;
});

/**
 * `1. ` typed at the start of a bullet item's text makes it a numbered item,
 * and `- ` at the start of a numbered item's text makes it a bullet. The
 * number then follows the list it joins.
 */
export const switchKind = EditorView.inputHandler.of((view, from, to, text) => {
  if (text !== ' ' || from !== to) return false;
  const { state } = view;
  const line = state.doc.lineAt(from);
  const before = line.text.slice(0, from - line.from);
  const m = /^( *)[-*+] +(\d{1,9}[.)])$/.exec(before) ?? /^( *)\d{1,9}[.)] +([-*+])$/.exec(before);
  if (!m || !itemAt(state, line)) return false;
  const insert = `${m[1]}${m[2]} `;
  view.dispatch({ changes: { from: line.from, to: from, insert }, selection: { anchor: line.from + insert.length }, userEvent: 'input.type' });
  return true;
});

// The drawn checkbox: 16px and a 10px gap (`.cm-task` in theme.ts).
const CHECKBOX = 26;
const remeasure = StateEffect.define<null>();

/**
 * Wrapped lines of an item hang under its text, not under its marker, at
 * every level. The marker's width is measured in the editor's own font, as it
 * shows: raw on the caret's line, a checkbox for a task elsewhere.
 */
class Hang {
  decorations: DecorationSet;
  probe: HTMLSpanElement;
  widths = new Map<string, number>();
  onFonts = () => {
    this.widths.clear();
    this.view.dispatch({ effects: remeasure.of(null) });
  };

  constructor(readonly view: EditorView) {
    this.probe = document.createElement('span');
    this.probe.setAttribute('aria-hidden', 'true');
    this.probe.style.cssText = 'position: absolute; visibility: hidden; white-space: pre; top: 0; left: 0';
    view.scrollDOM.appendChild(this.probe);
    document.fonts?.addEventListener('loadingdone', this.onFonts);
    this.decorations = this.build();
  }

  update(u: ViewUpdate) {
    if (u.docChanged || u.selectionSet || u.viewportChanged || u.focusChanged || syntaxTree(u.startState) !== syntaxTree(u.state) || u.transactions.some((t) => t.effects.some((e) => e.is(remeasure)))) {
      this.decorations = this.build();
    }
  }

  destroy() {
    document.fonts?.removeEventListener('loadingdone', this.onFonts);
    this.probe.remove();
  }

  width(text: string): number {
    if (!text) return 0;
    let w = this.widths.get(text);
    if (w === undefined) {
      this.probe.textContent = text;
      w = this.probe.getBoundingClientRect().width;
      this.widths.set(text, w);
    }
    return w;
  }

  build(): DecorationSet {
    const { state } = this.view;
    const active = activeLines(state, this.view.hasFocus);
    const decos: Range<Decoration>[] = [];
    for (const { from, to } of this.view.visibleRanges) {
      syntaxTree(state).iterate({
        from,
        to,
        enter: (node) => {
          if (node.name !== 'ListItem') return;
          const line = state.doc.lineAt(node.from);
          const m = ITEM.exec(line.text);
          // Only an item that starts its line: not one in a quote or after another marker.
          if (!m || line.from + m[1].length !== node.from) return;
          const task = /^\[[ xX]\]( +|$)/.exec(line.text.slice(m[0].length));
          let w: number;
          if (task && !active.has(line.number)) w = this.width(m[1]) + CHECKBOX + this.width(task[1]);
          else w = this.width(line.text.slice(0, m[0].length + (task ? task[0].length : 0)));
          if (w > 0) decos.push(Decoration.line({ attributes: { style: `padding-left: ${w}px; text-indent: -${w}px` } }).range(line.from));
        },
      });
    }
    return Decoration.set(decos, true);
  }
}

export const listHang = ViewPlugin.fromClass(Hang, { decorations: (v) => v.decorations });

export const lists = [renumberLists, switchKind, listHang];
