// Pictures in the editor: `![[name.png]]` and `![alt](attachments/name.png)`
// drawn as the picture when the caret is not on their line, and images pasted
// or dropped into a note saved beside the notes (`attachments/`) and embedded.
// A drawing (`.svg`) opens again for drawing on a click. No picture is ever
// fetched from the network: a web address stays as text.

import { Facet, StateEffect } from '@codemirror/state';
import { EditorView, WidgetType } from '@codemirror/view';
import { pictureUrl, savePicture } from '../lib/api';

export const PICTURE = /\.(png|jpe?g|gif|webp|svg)$/i;

/** Where the window hears that a drawing should open, by its name. */
export const onOpenDrawing = Facet.define<(name: string) => void, ((name: string) => void) | null>({
  combine: (values) => values[0] ?? null,
});

/** Where the window hears that a picture should leave the note, by its name. */
export const onRemovePicture = Facet.define<(name: string) => void, ((name: string) => void) | null>({
  combine: (values) => values[0] ?? null,
});

const HOLD_MS = 1000;
// The wind icon from `Icon.svelte`: a picture is let go as a note is.
const WIND = '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 6c3-2 5 2 8 0s3-1 4-1M2 10c3-2 5 2 8 0s3-1 4-1"/></svg>';

/**
 * "Let go" on a picture, shown on hover. It takes a held press, as letting
 * go of a note does: it fills while held and drains if let go early.
 */
function removeButton(onDone: () => void): HTMLElement {
  const b = document.createElement('button');
  b.className = 'cm-picture-remove';
  b.setAttribute('aria-label', 'Hold to let go of this picture');
  b.innerHTML = `${WIND}<span>Let go</span>`;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const stop = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    b.classList.remove('holding');
  };
  b.addEventListener('mousedown', (e) => {
    // Neither the caret nor the drawing sheet moves for this press.
    e.preventDefault();
    e.stopPropagation();
  });
  b.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    b.classList.add('holding');
    timer = setTimeout(() => {
      stop();
      onDone();
    }, HOLD_MS);
  });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, stop);
  return b;
}

export class PictureWidget extends WidgetType {
  constructor(
    readonly name: string,
    readonly alt: string,
    readonly version: number,
  ) {
    super();
  }
  eq(other: PictureWidget) {
    return other.name === this.name && other.alt === this.alt && other.version === this.version;
  }
  toDOM(view: EditorView) {
    const wrap = document.createElement('span');
    wrap.className = 'cm-picture';
    if (/\.svg$/i.test(this.name)) {
      wrap.classList.add('cm-drawing');
      wrap.title = 'Draw';
      wrap.addEventListener('mousedown', (e) => {
        e.preventDefault();
        view.state.facet(onOpenDrawing)?.(this.name);
      });
    }
    const img = document.createElement('img');
    img.alt = this.alt || this.name;
    img.draggable = false;
    img.addEventListener('load', () => {
      wrap.classList.add('loaded');
      view.requestMeasure();
    });
    pictureUrl(this.name).then((url) => {
      if (url) img.src = url;
      else {
        wrap.classList.add('missing');
        wrap.textContent = this.name;
      }
    });
    wrap.append(img);
    wrap.append(removeButton(() => view.state.facet(onRemovePicture)?.(this.name)));
    return wrap;
  }
  ignoreEvent() {
    return false;
  }
}

/** A name for a picture made now: `Pasted 2026-11-01 14.03.png`. */
export function stampedName(kind: string, ext: string, at = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${kind} ${at.getFullYear()}-${p(at.getMonth() + 1)}-${p(at.getDate())} ${p(at.getHours())}.${p(at.getMinutes())}.${ext}`;
}

const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg' };

async function embedFiles(view: EditorView, files: File[], at: number) {
  const embeds: string[] = [];
  for (const f of files) {
    const ext = EXT[f.type];
    if (!ext) continue;
    const name = await savePicture(stampedName('Pasted', ext), new Uint8Array(await f.arrayBuffer()));
    embeds.push(`![[${name}]]`);
  }
  if (!embeds.length) return;
  const line = view.state.doc.lineAt(at);
  // On a line of its own, so it is drawn as a block.
  const before = at === line.from ? '' : '\n';
  const insert = `${before}${embeds.join('\n')}\n`;
  view.dispatch({ changes: { from: at, insert }, selection: { anchor: at + insert.length } });
  view.focus();
}

const images = (list: FileList | null | undefined) => [...(list ?? [])].filter((f) => f.type in EXT);

export const pictureEvents = EditorView.domEventHandlers({
  paste(event, view) {
    const files = images(event.clipboardData?.files);
    if (!files.length) return false;
    event.preventDefault();
    embedFiles(view, files, view.state.selection.main.head);
    return true;
  },
  drop(event, view) {
    const files = images(event.dataTransfer?.files);
    if (!files.length) return false;
    event.preventDefault();
    const at = view.posAtCoords({ x: event.clientX, y: event.clientY }) ?? view.state.selection.main.head;
    embedFiles(view, files, at);
    return true;
  },
});

// A picture changed on disk (a drawing saved again) is drawn again: its
// version goes up, and the editor hears `refreshPictures`.
const versions = new Map<string, number>();
export const versionOf = (name: string) => versions.get(name) ?? 0;
export const refreshPictures = StateEffect.define<null>();

export function pictureChanged(view: EditorView | undefined, name: string) {
  versions.set(name, versionOf(name) + 1);
  view?.dispatch({ effects: refreshPictures.of(null) });
}
