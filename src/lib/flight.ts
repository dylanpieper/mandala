// Keep motion: a kept note's row lifts out of the sand rail as a card and
// glides to its place in the stone rail, turning from sand to stone. The
// stone row shows only when the card lands. Nothing flies when either row is
// not on screen (a rail hidden or faded, a folder closed) or with reduced motion.

const FLIGHT_MS = 700;

/** Where the row for `rel` is in a rail (`.side.sand` or `.side.stone`), if it is showing. */
export function rowRect(side: 'sand' | 'stone', rel: string): DOMRect | null {
  const rail = document.querySelector<HTMLElement>(`.side.${side}`);
  if (!rail || rail.offsetWidth === 0 || getComputedStyle(rail).opacity === '0') return null;
  const row = rail.querySelector<HTMLElement>(`[data-rel="${CSS.escape(rel)}"]`);
  const r = row?.getBoundingClientRect();
  return r && r.width > 0 && r.height > 0 ? r : null;
}

function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Fly a card titled `title` from `from` to the stone row for `rel`. Resolves when it lands. */
export async function flyToStone(title: string, from: DOMRect, rel: string): Promise<void> {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const row = document.querySelector<HTMLElement>(`.side.stone [data-rel="${CSS.escape(rel)}"]`);
  row?.scrollIntoView({ block: 'nearest' });
  const to = rowRect('stone', rel);
  if (!row || !to) return;

  const card = document.createElement('div');
  card.className = 'flight';
  card.textContent = title;
  document.body.append(card);
  row.style.visibility = 'hidden';

  // Position and size move, not a scale, so the title is never squashed.
  const box = (r: DOMRect) => ({ left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
  const flight = card.animate(
    [
      { ...box(from), color: cssVar('--sand'), borderColor: cssVar('--sand-line'), background: cssVar('--sand-ground'), boxShadow: '0 0 0 rgb(0 0 0 / 0)' },
      { offset: 0.4, boxShadow: '0 16px 36px rgb(0 0 0 / 0.4)' },
      { ...box(to), color: cssVar('--stone'), borderColor: cssVar('--stone-line'), background: cssVar('--stone-ground'), boxShadow: '0 0 0 rgb(0 0 0 / 0)' },
    ],
    { duration: FLIGHT_MS, easing: cssVar('--ease') || 'ease-out', fill: 'forwards' },
  );
  try {
    await flight.finished;
  } finally {
    row.style.visibility = '';
    card.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160 }).finished.then(() => card.remove());
  }
}
