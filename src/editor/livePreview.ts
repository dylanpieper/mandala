// Live preview, as Obsidian does it: markdown is drawn as it reads, and its
// syntax (`#`, `**`, `[[ ]]`, `> `) shows only on the lines the caret is on.
// Read site/docs/editor.md before changing this.

import { syntaxTree } from '@codemirror/language';
import { type EditorState, type Range, Facet } from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate, WidgetType } from '@codemirror/view';
import { openLink } from '../lib/api';
import { sortTaskRun } from './tasks';
import { PICTURE, PictureWidget, refreshPictures, versionOf } from './pictures';

const hide = Decoration.replace({});

class CheckboxWidget extends WidgetType {
  constructor(readonly checked: boolean) {
    super();
  }
  eq(other: CheckboxWidget) {
    return other.checked === this.checked;
  }
  toDOM() {
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = this.checked;
    box.className = 'cm-task';
    box.setAttribute('aria-label', this.checked ? 'Done' : 'Not done');
    return box;
  }
  ignoreEvent() {
    return false;
  }
}

/** Lines that hold a selection or the caret, while the editor has focus: their syntax stays visible. */
function activeLines(state: EditorState, focused: boolean): Set<number> {
  const lines = new Set<number>();
  if (!focused) return lines;
  for (const r of state.selection.ranges) {
    const first = state.doc.lineAt(r.from).number;
    const last = state.doc.lineAt(r.to).number;
    for (let n = first; n <= last; n++) lines.add(n);
  }
  return lines;
}

const WIKILINK = /!?\[\[([^\]\n]+?)\]\]/g;

function safeDecode(s: string): string {
  try {
    return decodeURI(s);
  } catch {
    return s;
  }
}

function build(view: EditorView): DecorationSet {
  const { state } = view;
  const active = activeLines(state, view.hasFocus);
  const isActive = (pos: number) => active.has(state.doc.lineAt(pos).number);
  // Bold, italic, strikethrough and inline code show their marks only while the
  // caret is in or touching that span, not anywhere on its line, as in Obsidian.
  const spanActive = (from: number, to: number) => view.hasFocus && state.selection.ranges.some((r) => r.from <= to && r.to >= from);
  const decos: Range<Decoration>[] = [];
  const wikiRanges: [number, number][] = [];

  for (const { from, to } of view.visibleRanges) {
    // [[wikilinks]] are not CommonMark, so they are found by pattern.
    const text = state.doc.sliceString(from, to);
    for (const m of text.matchAll(WIKILINK)) {
      const start = from + m.index!;
      const end = start + m[0].length;
      wikiRanges.push([start, end]);
      const inner = m[1];
      const bar = inner.indexOf('|');
      const open = m[0].startsWith('!') ? 3 : 2;
      const target = bar >= 0 ? inner.slice(0, bar) : inner;
      if (open === 3 && PICTURE.test(target.trim()) && !isActive(start)) {
        const name = target.trim();
        decos.push(Decoration.replace({ widget: new PictureWidget(name, bar >= 0 ? inner.slice(bar + 1) : '', versionOf(name)) }).range(start, end));
        continue;
      }
      decos.push(Decoration.mark({ class: 'cm-wikilink', attributes: { 'data-link': target.trim() } }).range(start + open, end - 2));
      if (!isActive(start)) {
        decos.push(hide.range(start, start + open));
        if (bar >= 0) decos.push(hide.range(start + open, start + open + bar + 1));
        decos.push(hide.range(end - 2, end));
      }
    }

    const inWiki = (a: number, b: number) => wikiRanges.some(([s, e]) => a < e && b > s);

    syntaxTree(state).iterate({
      from,
      to,
      enter: (node) => {
        const name = node.name;
        const lineActive = isActive(node.from);
        // `[[x]]` can also read as a CommonMark link; the wikilink wins.
        if ((name === 'Link' || name === 'LinkMark' || name === 'URL') && inWiki(node.from, node.to)) return;

        // `![alt](attachments/a.png)`: a picture in the vault. A web address
        // is never fetched, so it stays as text.
        if (name === 'Image') {
          const url = node.node.getChild('URL');
          const src = url ? safeDecode(state.doc.sliceString(url.from, url.to)) : '';
          if (src && !/^[a-z]+:/i.test(src) && PICTURE.test(src) && !lineActive) {
            const raw = state.doc.sliceString(node.from, node.to);
            const alt = /^!\[([^\]]*)\]/.exec(raw)?.[1] ?? '';
            decos.push(Decoration.replace({ widget: new PictureWidget(src, alt, versionOf(src)) }).range(node.from, node.to));
          }
          return false;
        }

        const heading = /^ATXHeading(\d)$/.exec(name);
        if (heading) {
          decos.push(Decoration.line({ class: `cm-h cm-h${heading[1]}` }).range(state.doc.lineAt(node.from).from));
          return;
        }
        switch (name) {
          case 'HeaderMark':
            if (!lineActive) {
              const after = state.doc.sliceString(node.to, node.to + 1) === ' ' ? 1 : 0;
              decos.push(hide.range(node.from, node.to + after));
            }
            break;
          case 'Emphasis':
            decos.push(Decoration.mark({ class: 'cm-em' }).range(node.from, node.to));
            break;
          case 'StrongEmphasis':
            decos.push(Decoration.mark({ class: 'cm-strong' }).range(node.from, node.to));
            break;
          case 'Strikethrough':
            decos.push(Decoration.mark({ class: 'cm-strike' }).range(node.from, node.to));
            break;
          case 'EmphasisMark':
          case 'StrikethroughMark': {
            const span = node.node.parent;
            if (!span || !spanActive(span.from, span.to)) decos.push(hide.range(node.from, node.to));
            break;
          }
          case 'InlineCode':
            decos.push(Decoration.mark({ class: 'cm-inline-code' }).range(node.from, node.to));
            break;
          case 'FencedCode': {
            // A block of code: mono on a raised ground, its fence lines faint.
            // The code itself is highlighted by its language (`setup.ts`).
            const first = state.doc.lineAt(node.from).number;
            const last = state.doc.lineAt(node.to).number;
            for (let n = first; n <= last; n++) {
              const edge = n === first ? ' cm-code-first cm-fence' : n === last && /^\s*(```|~~~)/.test(state.doc.line(n).text) ? ' cm-code-last cm-fence' : '';
              decos.push(Decoration.line({ class: `cm-codeblock${edge}` }).range(state.doc.line(n).from));
            }
            break;
          }
          case 'CodeMark': {
            const span = node.node.parent;
            if (span?.name === 'InlineCode' && !spanActive(span.from, span.to)) decos.push(hide.range(node.from, node.to));
            break;
          }
          case 'Link': {
            const url = node.node.getChild('URL');
            const href = url ? state.doc.sliceString(url.from, url.to) : '';
            decos.push(Decoration.mark({ class: 'cm-link', attributes: href ? { 'data-href': href } : {} }).range(node.from, node.to));
            break;
          }
          case 'LinkMark':
          case 'URL':
            if (node.node.parent?.name === 'Link') {
              if (!lineActive) decos.push(hide.range(node.from, node.to));
            } else if (node.name === 'URL') {
              // A bare `https://…` or `<https://…>`: drawn and opened like a link.
              const href = state.doc.sliceString(node.from, node.to);
              decos.push(Decoration.mark({ class: 'cm-link', attributes: { 'data-href': href } }).range(node.from, node.to));
            }
            break;
          case 'Blockquote':
            for (let pos = node.from; pos <= node.to; ) {
              const line = state.doc.lineAt(pos);
              decos.push(Decoration.line({ class: 'cm-quote' }).range(line.from));
              pos = line.to + 1;
            }
            break;
          case 'QuoteMark':
            if (!lineActive) {
              const after = state.doc.sliceString(node.to, node.to + 1) === ' ' ? 1 : 0;
              decos.push(hide.range(node.from, node.to + after));
            }
            break;
          case 'TaskMarker': {
            const checked = /x/i.test(state.doc.sliceString(node.from, node.to));
            if (!lineActive) {
              decos.push(Decoration.replace({ widget: new CheckboxWidget(checked) }).range(node.from, node.to));
              const listMark = node.node.parent?.parent?.firstChild;
              if (listMark?.name === 'ListMark') decos.push(hide.range(listMark.from, listMark.to + 1));
            }
            if (checked) {
              const line = state.doc.lineAt(node.from);
              decos.push(Decoration.mark({ class: 'cm-done' }).range(node.to, line.to));
            }
            break;
          }
          case 'HorizontalRule':
            decos.push(Decoration.line({ class: 'cm-hr' }).range(state.doc.lineAt(node.from).from));
            break;
        }
      },
    });
  }
  return Decoration.set(decos, true);
}

/**
 * Toggle `[ ]` ⇄ `[x]` when a drawn checkbox is clicked, and sort its list so
 * done tasks sit below open ones. One change, so one undo.
 */
function toggleTask(view: EditorView, target: HTMLElement): boolean {
  if (!(target instanceof HTMLInputElement) || !target.classList.contains('cm-task')) return false;
  const pos = view.posAtDOM(target);
  const { doc } = view.state;
  const marker = doc.sliceString(pos, pos + 3);
  if (!/^\[[ xX]\]$/.test(marker)) return false;
  const flip = marker[1] === ' ' ? 'x' : ' ';

  const line = doc.lineAt(pos);
  const lines = doc.toString().split('\n');
  const at = line.number - 1;
  const col = pos + 1 - line.from;
  lines[at] = lines[at].slice(0, col) + flip + lines[at].slice(col + 1);
  const run = sortTaskRun(lines, at);
  if (!run) {
    view.dispatch({ changes: { from: pos + 1, to: pos + 2, insert: flip } });
    return true;
  }
  const from = doc.line(run.from + 1).from;
  const to = doc.line(run.to).to;
  view.dispatch({ changes: { from, to, insert: run.lines.join('\n') } });
  return true;
}

/** Where the window hears that a [[link]] was followed. */
export const onFollowLink = Facet.define<(target: string) => void, ((target: string) => void) | null>({
  combine: (values) => values[0] ?? null,
});

/**
 * A drawn link opens on a click. On the line being edited, where its syntax
 * shows, a click places the caret; ⌘-click still opens it.
 */
function followable(view: EditorView, el: HTMLElement, event: MouseEvent): boolean {
  if (event.metaKey || event.ctrlKey) return true;
  const line = view.state.doc.lineAt(view.posAtDOM(el)).number;
  return !activeLines(view.state, view.hasFocus).has(line);
}

export const livePreview = [
  ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = build(view);
      }
      update(u: ViewUpdate) {
        if (u.docChanged || u.selectionSet || u.viewportChanged || u.focusChanged || syntaxTree(u.startState) !== syntaxTree(u.state) || u.transactions.some((t) => t.effects.some((e) => e.is(refreshPictures)))) {
          this.decorations = build(u.view);
        }
      }
    },
    { decorations: (v) => v.decorations },
  ),
  EditorView.domEventHandlers({
    mousedown(event, view) {
      const target = event.target as HTMLElement;
      if (toggleTask(view, target)) {
        event.preventDefault();
        return true;
      }
      const wiki = target.closest<HTMLElement>('.cm-wikilink');
      if (wiki && followable(view, wiki, event)) {
        view.state.facet(onFollowLink)?.(wiki.dataset.link ?? wiki.textContent ?? '');
        event.preventDefault();
        return true;
      }
      const web = target.closest<HTMLElement>('.cm-link[data-href]');
      if (web && followable(view, web, event)) {
        openLink(web.dataset.href!);
        event.preventDefault();
        return true;
      }
      return false;
    },
  }),
];
