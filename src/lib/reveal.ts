// The rails find the open note: its row scrolls into view, and if it had to
// be found (scrolled to, or its folder opened), it glows once, softly, so the
// eye lands on it. A row already in view does not glow: it was just clicked.

/** The nearest ancestor of `el` that scrolls, or null. */
function scroller(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const y = getComputedStyle(p).overflowY;
    if ((y === 'auto' || y === 'scroll') && p.scrollHeight > p.clientHeight) return p;
  }
  return null;
}

/** Bring the row for `rel` in `rail` into view. `opened`: its folder was just opened. */
export function reveal(rail: HTMLElement | undefined, rel: string | null, opened = false) {
  if (!rail || !rel) return;
  const row = rail.querySelector<HTMLElement>(`[data-rel="${CSS.escape(rel)}"]`);
  if (!row) return;
  const box = scroller(row)?.getBoundingClientRect();
  const r = row.getBoundingClientRect();
  const hidden = box ? r.top < box.top || r.bottom > box.bottom : false;
  if (hidden) row.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  if (hidden || opened) {
    row.classList.remove('found');
    // Once more from the start, if it was still glowing.
    void row.offsetWidth;
    row.classList.add('found');
    row.addEventListener('animationend', () => row.classList.remove('found'), { once: true });
  }
}
