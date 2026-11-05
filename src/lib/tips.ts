// Drawing tips (`Draw.svelte`). Every tip saves as plain SVG, so Obsidian
// shows it: the pen, highlighter and pencil as stroked paths, the brush as a
// filled outline. The brush's outline is drawn by perfect-freehand (1.2.3,
// MIT), the library tldraw and Excalidraw use: it streamlines the hand's
// points, smooths the edges and tapers the ends. Mandala gives it the
// pressure at each point, from a calligraphy nib held at 45°.
import { getStroke } from 'perfect-freehand';

export type Tip = 'pen' | 'brush' | 'marker' | 'pencil';

/** How each stroked tip looks: its width from the chosen size, its opacity, its ends. */
export const TIPS: Record<Exclude<Tip, 'brush'>, { width: (size: number) => number; opacity: number; cap: 'round' | 'butt' }> = {
  pen: { width: (s) => s, opacity: 1, cap: 'round' },
  marker: { width: (s) => Math.max(12, s * 4), opacity: 0.35, cap: 'butt' },
  pencil: { width: (s) => Math.max(0.8, s * 0.55), opacity: 0.7, cap: 'round' },
};

type Raw = { x: number; y: number; pressure: number };

/** The nib, held at 45°. */
const NIB = { x: Math.SQRT1_2, y: Math.SQRT1_2 };

/**
 * The pressure at each point, as a calligraphy nib gives it: high where the
 * stroke crosses the nib, low where it runs along it, eased along the stroke
 * so it never jumps. A pen's own pressure (0 when none is known) makes it fuller.
 */
export function nibPressure(points: Raw[]): number[] {
  const n = points.length;
  const raw = points.map((p, i) => {
    const a = points[Math.max(0, i - 3)];
    const b = points[Math.min(n - 1, i + 3)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    const across = len ? Math.abs((dx * NIB.y - dy * NIB.x) / len) : 0.5;
    const press = p.pressure > 0 ? 0.4 + p.pressure * 0.6 : 1;
    return (0.15 + 0.85 * across) * press;
  });
  return raw.map((_, i) => {
    const near = raw.slice(Math.max(0, i - 4), i + 5);
    return near.reduce((s, v) => s + v, 0) / near.length;
  });
}

const avg = (a: number, b: number) => (a + b) / 2;
const f = (n: number) => Math.round(n * 100) / 100;

/** The outline as a smooth SVG path (the recipe from perfect-freehand's README). */
function pathOf(outline: number[][]): string {
  if (outline.length < 4) return '';
  let a = outline[0];
  let b = outline[1];
  const c = outline[2];
  let d = `M${f(a[0])},${f(a[1])} Q${f(b[0])},${f(b[1])} ${f(avg(b[0], c[0]))},${f(avg(b[1], c[1]))} T`;
  for (let i = 2; i < outline.length - 1; i++) {
    a = outline[i];
    b = outline[i + 1];
    d += `${f(avg(a[0], b[0]))},${f(avg(a[1], b[1]))} `;
  }
  return `${d}Z`;
}

/**
 * The brush stroke through the hand's points, as a filled SVG path: narrow,
 * thick, narrow. `done` is false while the stroke is still being drawn.
 */
export function brushPath(points: Raw[], size: number, done: boolean): string {
  if (!points.length) return '';
  const width = size * 2.4;
  if (points.length === 1) {
    const { x, y } = points[0];
    const r = width / 4;
    return `M${f(x - r)},${f(y)} a${f(r)},${f(r)} 0 1 0 ${f(r * 2)},0 a${f(r)},${f(r)} 0 1 0 ${f(-r * 2)},0Z`;
  }
  const pressure = nibPressure(points);
  const outline = getStroke(
    points.map((p, i) => [p.x, p.y, pressure[i]]),
    {
      size: width,
      thinning: 0.8,
      smoothing: 0.6,
      streamline: 0.55,
      simulatePressure: false,
      easing: (t) => t,
      start: { taper: width * 2.5, easing: (t) => t * (2 - t) },
      end: { taper: width * 2.5, easing: (t) => t * (2 - t) },
      last: done,
    },
  );
  return pathOf(outline);
}
