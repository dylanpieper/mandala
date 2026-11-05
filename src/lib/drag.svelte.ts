// Dragging notes between and within the rails, with pointer events (not HTML5
// drag and drop, which Tauri's own file-drop handling can swallow). A press
// that moves less than a few pixels stays a click.
//
// `use:draggable` marks what can be lifted; `use:droppable` marks where it can
// land. While dragging, the target under the pointer gets `.drop-over`, and a
// list target also `.drop-before` or `.drop-after` by which half is under it.
// A target that takes `onto` (a note, to combine with) gets `.drop-onto` once
// the pointer rests on its middle for `ONTO_MS`: then a drop lands on it, not
// beside it.

import type { Life } from './types';

export interface Lifted {
  rel: string;
  title: string;
  kind: 'stone' | 'sand';
  life?: Life | null;
}

export interface DropInfo {
  /** For list targets: the pointer is in the lower half. */
  after: boolean;
  /** Dropped onto the target itself (it had `.drop-onto`). */
  onto: boolean;
}

export interface DropOptions {
  accepts: (item: Lifted) => boolean;
  drop: (item: Lifted, info: DropInfo) => void;
  /** A list item: shows a line before or after, by the pointer's half. */
  list?: boolean;
  /** Can take a drop onto itself, after a rest on its middle. */
  onto?: boolean;
  /** Takes only drops onto itself. */
  ontoOnly?: boolean;
}

export const drag = $state<{ item: Lifted | null; x: number; y: number; onto: boolean }>({ item: null, x: 0, y: 0, onto: false });

const ONTO_MS = 500;
let ontoTimer: ReturnType<typeof setTimeout> | null = null;
let lastY = 0;

/** The middle half of a target, where resting means "onto". */
function middle(el: HTMLElement, y: number) {
  const r = el.getBoundingClientRect();
  return y > r.top + r.height * 0.25 && y < r.bottom - r.height * 0.25;
}

function clearOnto() {
  if (ontoTimer) clearTimeout(ontoTimer);
  ontoTimer = null;
  drag.onto = false;
  over?.classList.remove('drop-onto');
}

const START_PX = 5;
const targets = new Map<HTMLElement, DropOptions>();
let over: HTMLElement | null = null;

function targetAt(x: number, y: number): HTMLElement | null {
  let el = document.elementFromPoint(x, y) as HTMLElement | null;
  while (el) {
    const opts = targets.get(el);
    if (opts && drag.item && opts.accepts(drag.item)) return el;
    el = el.parentElement;
  }
  return null;
}

function mark(el: HTMLElement | null, y: number) {
  lastY = y;
  if (over !== el) {
    clearOnto();
    over?.classList.remove('drop-over', 'drop-before', 'drop-after');
  }
  over = el;
  if (!el) return;
  el.classList.add('drop-over');
  const opts = targets.get(el);
  if (opts?.onto) {
    if (!middle(el, y)) clearOnto();
    else if (!drag.onto && !ontoTimer) {
      ontoTimer = setTimeout(() => {
        ontoTimer = null;
        if (over === el && middle(el, lastY)) {
          drag.onto = true;
          el.classList.remove('drop-before', 'drop-after');
          el.classList.add('drop-onto');
        }
      }, ONTO_MS);
    }
    if (drag.onto) return;
  }
  if (opts?.list) {
    const r = el.getBoundingClientRect();
    const after = y > r.top + r.height / 2;
    el.classList.toggle('drop-after', after);
    el.classList.toggle('drop-before', !after);
  }
}

export function draggable(node: HTMLElement, item: Lifted) {
  let current = item;
  let start: { x: number; y: number; id: number } | null = null;
  let dragging = false;

  const down = (e: PointerEvent) => {
    if (e.button !== 0) return;
    start = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const move = (e: PointerEvent) => {
    if (!start || e.pointerId !== start.id) return;
    if (!dragging) {
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < START_PX) return;
      dragging = true;
      node.setPointerCapture(e.pointerId);
      node.classList.add('lifted');
      document.body.classList.add('dragging');
      drag.item = current;
    }
    drag.x = e.clientX;
    drag.y = e.clientY;
    mark(targetAt(e.clientX, e.clientY), e.clientY);
  };
  const end = (e: PointerEvent, dropIt: boolean) => {
    if (!start || e.pointerId !== start.id) return;
    start = null;
    if (!dragging) return;
    dragging = false;
    const found = dropIt ? targetAt(e.clientX, e.clientY) : null;
    const after = found?.classList.contains('drop-after') ?? false;
    const onto = !!found && found === over && drag.onto;
    // A target that takes only drops onto it ignores a drop beside it.
    const target = found && (onto || !targets.get(found)?.ontoOnly) ? found : null;
    mark(null, 0);
    node.classList.remove('lifted');
    document.body.classList.remove('dragging');
    const lifted = drag.item;
    drag.item = null;
    // The click that follows a drag (if the browser sends one) must not open the note.
    const swallow = (c: MouseEvent) => (c.preventDefault(), c.stopImmediatePropagation());
    node.addEventListener('click', swallow, { capture: true, once: true });
    setTimeout(() => node.removeEventListener('click', swallow, { capture: true }), 0);
    if (target && lifted) targets.get(target)?.drop(lifted, { after, onto });
  };
  const up = (e: PointerEvent) => end(e, true);
  const cancel = (e: PointerEvent) => end(e, false);
  const key = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && dragging && start) end(new PointerEvent('pointercancel', { pointerId: start.id }), false);
  };

  node.addEventListener('pointerdown', down);
  node.addEventListener('pointermove', move);
  node.addEventListener('pointerup', up);
  node.addEventListener('pointercancel', cancel);
  window.addEventListener('keydown', key);
  return {
    update(next: Lifted) {
      current = next;
    },
    destroy() {
      node.removeEventListener('pointerdown', down);
      node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerup', up);
      node.removeEventListener('pointercancel', cancel);
      window.removeEventListener('keydown', key);
    },
  };
}

export function droppable(node: HTMLElement, options: DropOptions) {
  targets.set(node, options);
  return {
    update(next: DropOptions) {
      targets.set(node, next);
    },
    destroy() {
      targets.delete(node);
      if (over === node) over = null;
    },
  };
}
