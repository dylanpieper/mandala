// Where each thing sits in the mandala view. The core says what there is
// (`mandala-core/src/mandala.rs`); this says where, in a 1000-unit square
// centred on 0, 0. Pure, so it is tested (`mandala.test.ts`).
//
// From the centre out: the glyph, loose stone as seeds, a petal per stone
// folder (the lotus), sand drifting from the lotus to the rim as it ages,
// and past the rim, dust: what settled in the last day.

import { leavingSoon } from './time';
import type { Life, Mandala, SandGrain } from './types';

export const R = {
  seeds: 44,
  petalBase: 66,
  petalMin: 60,
  petalMax: 186,
  lotus: 258,
  sandIn: 276,
  rim: 440,
  dustIn: 456,
  dustOut: 492,
};

export interface Point {
  x: number;
  y: number;
}

export interface PlacedStone extends Point {
  rel: string;
  title: string;
  folder: string;
  r: number;
}

export interface PlacedPetal {
  folder: string;
  /** Degrees clockwise from straight up. */
  angle: number;
  /** The petal's outline, pointing straight up; rotate by `angle`. */
  path: string;
  tip: number;
  notes: PlacedStone[];
}

export interface PlacedGrain extends SandGrain, Point {
  r: number;
  color: string;
}

export interface PlacedDust extends Point {
  id: string;
  title: string;
  at: string;
  settled: number;
  opacity: number;
}

export interface Layout {
  seeds: PlacedStone[];
  petals: PlacedPetal[];
  grains: PlacedGrain[];
  links: { from: string; to: string; d: string }[];
  dust: PlacedDust[];
}

/** A stable angle in [0, 2π) for a name, so a grain keeps its bearing as it ages. */
export function bearing(name: string): number {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) / 2 ** 32) * Math.PI * 2;
}

const polar = (r: number, a: number): Point => ({ x: r * Math.sin(a), y: -r * Math.cos(a) });
const round = (n: number) => Math.round(n * 10) / 10;

/** Sand moves outward as it ages: at the lotus when new, at the rim when it runs out. */
export function grainRadius(fractionLeft: number): number {
  const f = Math.max(0, Math.min(1, fractionLeft));
  return R.sandIn + (1 - f) * (R.rim - R.sandIn);
}

const GRAIN_SIZE: Record<Life, number> = { breath: 3, sun: 3.5, quarter: 4, half: 4.5, full: 5 };
const GRAIN_COLOR: Record<Life, string> = {
  breath: 'var(--bone)',
  sun: 'var(--sand)',
  quarter: 'var(--jade)',
  half: 'var(--lapis)',
  full: 'var(--parchment)',
};

/** A grain's color: its lifespan's, or vermilion when it leaves soon, by the
 * same rule as the sand rail's bars (`leavingSoon`). */
export function grainColor(g: Pick<SandGrain, 'life' | 'dissolves'>, now: Date = new Date()): string {
  return leavingSoon(g.dissolves, now) ? 'var(--vermilion)' : GRAIN_COLOR[g.life];
}

function petalPath(base: number, tip: number, half: number): string {
  const len = tip - base;
  const w = Math.min((base + len * 0.5) * Math.tan(half), 64);
  const y = (t: number) => round(-(base + len * t));
  return `M0 ${y(0)}C${round(w)} ${y(0.22)} ${round(w)} ${y(0.72)} 0 ${y(1)}C${round(-w)} ${y(0.72)} ${round(-w)} ${y(0.22)} 0 ${y(0)}Z`;
}

export function layout(m: Mandala, now: Date = new Date()): Layout {
  const n = m.petals.length;
  const most = Math.max(1, ...m.petals.map((p) => p.notes.length));
  const half = n ? Math.min((Math.PI / n) * 0.82, 0.62) : 0;

  const petals: PlacedPetal[] = m.petals.map((p, i) => {
    const a = (i / n) * Math.PI * 2;
    const k = p.notes.length;
    const tip = R.petalBase + R.petalMin + (R.petalMax - R.petalMin) * Math.sqrt(k / most);
    const len = tip - R.petalBase;
    const w = Math.min((R.petalBase + len * 0.5) * Math.tan(half), 64);
    const dot = Math.max(2.4, Math.min(4.5, 5 - k / 8));
    const notes = p.notes.map((s, j) => {
      const t = k === 1 ? 0.55 : 0.2 + (0.66 * j) / (k - 1);
      const side = k === 1 ? 0 : j % 2 ? 1 : -1;
      const lx = side * w * 0.42 * Math.sin(Math.PI * t);
      const ly = -(R.petalBase + len * t);
      // Rotate the petal's own point by its bearing.
      return { ...s, folder: p.folder, r: dot, x: round(lx * Math.cos(a) - ly * Math.sin(a)), y: round(lx * Math.sin(a) + ly * Math.cos(a)) };
    });
    return { folder: p.folder, angle: round((a * 180) / Math.PI), path: petalPath(R.petalBase, tip, half), tip, notes };
  });

  const seeds: PlacedStone[] = m.seeds.map((s, i) => {
    const p = polar(R.seeds, (i / Math.max(1, m.seeds.length)) * Math.PI * 2 + Math.PI / Math.max(1, n || 4));
    return { ...s, folder: '', r: 3.5, x: round(p.x), y: round(p.y) };
  });

  const grains: PlacedGrain[] = m.grains.map((g) => {
    const p = polar(grainRadius(g.fraction_left), bearing(g.rel));
    return { ...g, x: round(p.x), y: round(p.y), r: GRAIN_SIZE[g.life], color: grainColor(g, now) };
  });

  const at = new Map<string, Point>();
  for (const s of [...seeds, ...petals.flatMap((p) => p.notes), ...grains]) at.set(s.rel, s);
  const links = m.links.flatMap(({ from, to }) => {
    const a = at.get(from);
    const b = at.get(to);
    if (!a || !b) return [];
    // Curve through a point pulled toward the centre, so links arc like the lotus.
    const c = { x: ((a.x + b.x) / 2) * 0.35, y: ((a.y + b.y) / 2) * 0.35 };
    return [{ from, to, d: `M${a.x} ${a.y}Q${round(c.x)} ${round(c.y)} ${b.x} ${b.y}` }];
  });

  const dust: PlacedDust[] = m.dust.map((d) => {
    const p = polar(R.dustIn + d.settled * (R.dustOut - R.dustIn), bearing(d.id + d.title));
    return { id: d.id, title: d.title, at: d.at, settled: d.settled, x: round(p.x), y: round(p.y), opacity: round(0.75 - 0.45 * d.settled) };
  });

  return { seeds, petals, grains, links, dust };
}
