// Tables, drawn and edited as tables. A markdown table (GFM) is always shown
// as a table; its cells are typed in directly, and the markdown is written
// back as they change. Block widgets must come from a state field, not a view
// plugin.
import { redo, undo } from '@codemirror/commands';
import { syntaxTree } from '@codemirror/language';
import { StateField, type EditorState, type Range } from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView, WidgetType } from '@codemirror/view';
import { modHeld } from '../lib/keys';

type Align = 'left' | 'right' | 'center' | null;
export interface Table {
  head: string[];
  align: Align[];
  rows: string[][];
}

/** The cells of one row: outer pipes dropped, `\|` kept as a pipe. */
function cells(line: string): string[] {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  return s.split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));
}

/** A markdown table's text, read; null if it has no delimiter row. */
export function parseTable(text: string): Table | null {
  const lines = text.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return null;
  const delim = cells(lines[1]);
  if (!delim.every((c) => /^:?-+:?$/.test(c))) return null;
  const align = delim.map((c): Align => (c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : c.startsWith(':') ? 'left' : null));
  const head = cells(lines[0]);
  const width = head.length;
  const fit = (r: string[]) => Array.from({ length: width }, (_, i) => r[i] ?? '');
  return { head: fit(head), align: align.slice(0, width).concat(Array(Math.max(0, width - align.length)).fill(null)), rows: lines.slice(2).map((l) => fit(cells(l))) };
}

/** A table written as markdown. A typed pipe is escaped; a line break becomes a space. */
export function tableMarkdown(t: Table): string {
  const cell = (c: string) => c.replace(/\n/g, ' ').replace(/\|/g, '\\|');
  const line = (cs: string[]) => `|${cs.map((c) => ` ${cell(c)} `).join('|')}|`;
  const delim = t.align.map((a) => (a === 'center' ? ':---:' : a === 'right' ? '---:' : a === 'left' ? ':---' : '---'));
  return [line(t.head), `|${delim.map((d) => ` ${d} `).join('|')}|`, ...t.rows.map(line)].join('\n');
}

/** An empty table, `cols` wide, with a header row and `rows` rows below it. */
export function makeTable(cols: number, rows: number): string {
  const empty = () => Array<string>(cols).fill('');
  return tableMarkdown({ head: empty(), align: Array(cols).fill(null), rows: Array.from({ length: rows }, empty) });
}

/** The table without body row `r`. The header row stays. */
export function removeRow(t: Table, r: number): Table {
  if (r < 0 || r >= t.rows.length) return t;
  return { ...t, rows: t.rows.filter((_, i) => i !== r) };
}

/** The table without column `c`, each other column keeping its alignment. The last column stays. */
export function removeColumn(t: Table, c: number): Table {
  if (t.head.length <= 1 || c < 0 || c >= t.head.length) return t;
  const drop = <T>(xs: T[]) => xs.filter((_, i) => i !== c);
  return { head: drop(t.head), align: drop(t.align), rows: t.rows.map(drop) };
}

/** Put an empty table at the caret, on lines of its own, with the caret in its first header cell. */
export function insertTable(view: EditorView, cols: number, rows: number) {
  const { state } = view;
  const at = state.selection.main.head;
  const line = state.doc.lineAt(at);
  // A table needs a blank line before it, unless it starts the note.
  const empty = line.text.trim() === '';
  const before = empty ? (line.number > 1 && state.doc.line(line.number - 1).text.trim() !== '' ? '\n' : '') : '\n\n';
  // And one after it: a line of text right below a table reads as a row.
  const next = line.number < state.doc.lines ? state.doc.line(line.number + 1).text.trim() : '';
  const after = empty && next === '' ? '' : '\n';
  const from = empty ? line.from : line.to;
  const insert = `${before}${makeTable(cols, rows)}${after}`;
  focusTableAt(from + before.length);
  view.dispatch({ changes: { from, to: line.to, insert } });
}

// The drawn table is edited in place: each cell is editable, and every change
// is written back to the note's markdown at once. The widget's DOM is updated
// in place (`updateDOM`), so the cell being typed in keeps the caret.

/** Each drawn table's column alignment, kept with its element. */
const aligns = new WeakMap<HTMLElement, Align[]>();
/** Set while a cell's own typing is written back, so that cell is left as it is. */
let writing = false;
/** A cell to put the caret in once a table is drawn again (a row or column added). */
let refocus: { from: number; r: number; c: number } | null = null;

function cellAt(wrap: HTMLElement, r: number, c: number) {
  return wrap.querySelector<HTMLElement>(`[data-r="${r}"][data-c="${c}"]`);
}

function focusCell(el: HTMLElement | null) {
  if (!el) return;
  el.focus();
  const sel = getSelection();
  sel?.selectAllChildren(el);
  sel?.collapseToEnd();
}

/** The table's range in the note, found from its drawn element. */
function rangeOf(view: EditorView, wrap: HTMLElement): { from: number; to: number } | null {
  const pos = view.posAtDOM(wrap);
  let found: { from: number; to: number } | null = null;
  view.state.field(drawn).between(pos, pos, (from, to) => {
    found = { from, to };
  });
  return found;
}

/** The table as its cells now read. */
function readTable(wrap: HTMLElement, align: Align[]): Table {
  const text = (el: Element) => (el.textContent ?? '').replace(/\n/g, ' ');
  const head = [...wrap.querySelectorAll('thead [data-c]')].map(text);
  const rows = [...wrap.querySelectorAll('tbody tr')].map((tr) => [...tr.querySelectorAll('[data-c]')].map(text));
  return { head, align, rows };
}

function write(view: EditorView, wrap: HTMLElement, table: Table, focusAfter?: { r: number; c: number }) {
  const range = rangeOf(view, wrap);
  if (!range) return;
  if (focusAfter) refocus = { from: range.from, ...focusAfter };
  writing = !focusAfter;
  try {
    view.dispatch({ changes: { ...range, insert: tableMarkdown(table) }, userEvent: 'input.table' });
  } finally {
    writing = false;
  }
}

class TableWidget extends WidgetType {
  constructor(
    readonly table: Table,
    readonly from: number,
  ) {
    super();
  }
  eq(other: TableWidget) {
    return other.from === this.from && JSON.stringify(other.table) === JSON.stringify(this.table);
  }

  toDOM(view: EditorView) {
    const wrap = document.createElement('div');
    wrap.className = 'cm-table';
    const table = wrap.appendChild(document.createElement('table'));
    const row = (parent: HTMLElement, values: string[], r: number, tag: 'th' | 'td') => {
      const tr = parent.appendChild(document.createElement('tr'));
      values.forEach((v, c) => {
        const cell = tr.appendChild(document.createElement(tag));
        cell.contentEditable = 'plaintext-only';
        cell.spellcheck = true;
        cell.dataset.r = String(r);
        cell.dataset.c = String(c);
        cell.textContent = v;
        if (this.table.align[c]) cell.style.textAlign = this.table.align[c]!;
      });
    };
    row(table.createTHead(), this.table.head, -1, 'th');
    const body = table.createTBody();
    this.table.rows.forEach((r, i) => row(body, r, i, 'td'));

    // Add a column at the right, a row at the bottom.
    const add = (cls: string, label: string, act: () => void) => {
      const b = wrap.appendChild(document.createElement('button'));
      b.className = `cm-table-add ${cls}`;
      b.setAttribute('aria-label', label);
      b.title = label;
      b.innerHTML = '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M8 3v10M3 8h10"/></svg>';
      b.addEventListener('mousedown', (e) => e.preventDefault());
      b.addEventListener('click', act);
    };
    const widget = this;
    const now = () => readTable(wrap, aligns.get(wrap) ?? widget.table.align);
    aligns.set(wrap, this.table.align);
    add('col', 'Add a column', () => {
      const t = now();
      write(view, wrap, { head: [...t.head, ''], align: [...t.align, null], rows: t.rows.map((r) => [...r, '']) }, { r: -1, c: t.head.length });
    });
    add('row', 'Add a row', () => {
      const t = now();
      write(view, wrap, { ...t, rows: [...t.rows, t.head.map(() => '')] }, { r: t.rows.length, c: 0 });
    });

    // Take out a row or a column: one quiet handle each, shown only for the
    // row and the column under the pointer (or with the caret), at the row's
    // left and above the column. The header row and a table's last column have none.
    const cross = '<svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>';
    const handle = (cls: string, label: string, act: (at: number) => void) => {
      const b = wrap.appendChild(document.createElement('button'));
      b.className = `cm-table-del ${cls}`;
      b.setAttribute('aria-label', label);
      b.title = label;
      b.tabIndex = -1;
      b.innerHTML = cross;
      b.addEventListener('mousedown', (e) => e.preventDefault());
      b.addEventListener('click', () => {
        const at = Number(b.dataset.at);
        b.classList.remove('on');
        act(at);
      });
      return b;
    };
    const delRow = handle('row', 'Remove this row', (r) => write(view, wrap, removeRow(now(), r)));
    const delCol = handle('col', 'Remove this column', (c) => write(view, wrap, removeColumn(now(), c)));
    // The handles go to the cell under the pointer, or else to the cell with
    // the caret, so moving with the keys moves them too.
    const place = (cell: HTMLElement) => {
      const box = wrap.getBoundingClientRect();
      const r = Number(cell.dataset.r);
      const c = Number(cell.dataset.c);
      const row = cell.parentElement!.getBoundingClientRect();
      const col = cell.getBoundingClientRect();
      delRow.classList.toggle('on', r >= 0);
      delRow.dataset.at = String(r);
      delRow.style.top = `${row.top - box.top + wrap.scrollTop + (row.height - 18) / 2}px`;
      delCol.classList.toggle('on', now().head.length > 1);
      delCol.dataset.at = String(c);
      delCol.style.left = `${col.left - box.left + wrap.scrollLeft + (col.width - 18) / 2}px`;
    };
    const hide = () => {
      delRow.classList.remove('on');
      delCol.classList.remove('on');
    };
    const caretCell = () => (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('[data-c]');
    wrap.addEventListener('pointerover', (e) => {
      const cell = (e.target as HTMLElement).closest<HTMLElement>('[data-c]');
      if (cell) place(cell);
    });
    wrap.addEventListener('pointerleave', () => {
      const cell = caretCell();
      if (cell && wrap.contains(cell)) place(cell);
      else hide();
    });
    wrap.addEventListener('focusin', (e) => {
      const cell = (e.target as HTMLElement).closest<HTMLElement>('[data-c]');
      if (cell) place(cell);
    });
    wrap.addEventListener('focusout', (e) => {
      if (!wrap.contains(e.relatedTarget as Node | null) && !wrap.matches(':hover')) hide();
    });

    wrap.addEventListener('input', () => write(view, wrap, now()));
    wrap.addEventListener('keydown', (e) => {
      const cell = (e.target as HTMLElement).closest<HTMLElement>('[data-c]');
      if (!cell) return;
      const r = Number(cell.dataset.r);
      const c = Number(cell.dataset.c);
      const t = now();
      const width = t.head.length;
      if (modHeld(e) && e.shiftKey && e.key === 'Backspace') {
        // ⌘⇧⌫ takes out the caret's row; the header row stays.
        e.preventDefault();
        if (r < 0) return;
        const left = t.rows.length - 1;
        write(view, wrap, removeRow(t, r), left > 0 ? { r: Math.min(r, left - 1), c } : { r: -1, c });
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        // Undo and redo are the note's, not the cell's.
        e.preventDefault();
        (e.shiftKey ? redo : undo)(view);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        const i = (r + 1) * width + c + (e.shiftKey ? -1 : 1);
        if (i < 0) return;
        if (i >= (t.rows.length + 1) * width) return write(view, wrap, { ...t, rows: [...t.rows, t.head.map(() => '')] }, { r: t.rows.length, c: 0 });
        focusCell(cellAt(wrap, Math.floor(i / width) - 1, i % width));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (r + 1 >= t.rows.length) return write(view, wrap, { ...t, rows: [...t.rows, t.head.map(() => '')] }, { r: t.rows.length, c });
        focusCell(cellAt(wrap, r + 1, c));
      } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !e.shiftKey && !modHeld(e) && !e.altKey) {
        // Up and down stay in the column. Past the header or the last row,
        // the caret leaves the table to the line above or below it.
        e.preventDefault();
        e.stopPropagation();
        const next = e.key === 'ArrowUp' ? r - 1 : r + 1;
        if (next >= -1 && next < t.rows.length) return focusCell(cellAt(wrap, next, c));
        const range = rangeOf(view, wrap);
        view.focus();
        if (!range) return;
        const at = e.key === 'ArrowUp' ? Math.max(0, range.from - 1) : Math.min(view.state.doc.length, range.to + 1);
        view.dispatch({ selection: { anchor: at }, scrollIntoView: true });
      } else if (e.key === 'Escape') {
        // Out of the table, to the line after it.
        e.preventDefault();
        const range = rangeOf(view, wrap);
        view.focus();
        if (range) view.dispatch({ selection: { anchor: Math.min(view.state.doc.length, range.to + 1) } });
      }
    });
    return wrap;
  }

  /** Same shape: change only the cells whose text changed, so the caret stays. */
  updateDOM(dom: HTMLElement) {
    const t = this.table;
    const head = dom.querySelectorAll<HTMLElement>('thead [data-c]');
    const rows = dom.querySelectorAll('tbody tr');
    if (head.length !== t.head.length || rows.length !== t.rows.length) return false;
    aligns.set(dom, t.align);
    const set = (el: HTMLElement, v: string) => {
      if (writing && el === document.activeElement) return;
      if (el.textContent !== v) el.textContent = v;
    };
    head.forEach((el, c) => set(el, t.head[c]));
    rows.forEach((tr, r) => tr.querySelectorAll<HTMLElement>('[data-c]').forEach((el, c) => set(el, t.rows[r][c])));
    return true;
  }

  ignoreEvent() {
    return true;
  }
}

function build(state: EditorState): DecorationSet {
  const decos: Range<Decoration>[] = [];
  syntaxTree(state).iterate({
    enter(node) {
      if (node.name !== 'Table') return;
      const from = state.doc.lineAt(node.from).from;
      const to = state.doc.lineAt(node.to).to;
      const table = parseTable(state.doc.sliceString(from, to));
      if (table) decos.push(Decoration.replace({ widget: new TableWidget(table, from), block: true }).range(from, to));
      return false;
    },
  });
  return Decoration.set(decos);
}

const drawn = StateField.define<DecorationSet>({
  create: build,
  update(value, tr) {
    return tr.docChanged || syntaxTree(tr.startState) !== syntaxTree(tr.state) ? build(tr.state) : value;
  },
  provide: (f) => EditorView.decorations.from(f),
});

export const tables = [
  drawn,
  // A table drawn again after a row or column was added: the caret goes to the new cell.
  EditorView.updateListener.of((u) => {
    if (!refocus || !u.docChanged) return;
    const want = refocus;
    requestAnimationFrame(() => {
      for (const wrap of u.view.dom.querySelectorAll<HTMLElement>('.cm-table')) {
        if (u.view.posAtDOM(wrap) === want.from) focusCell(cellAt(wrap, want.r, want.c));
      }
      refocus = null;
    });
  }),
];

/** The caret into a new table's first cell, once it is drawn. */
export function focusTableAt(from: number) {
  refocus = { from, r: -1, c: 0 };
}
