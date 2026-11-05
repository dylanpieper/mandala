import { describe, expect, it } from 'vitest';
import { bearing, grainColor, grainRadius, layout, R } from './mandala';
import type { Mandala } from './types';

const dist = (p: { x: number; y: number }) => Math.hypot(p.x, p.y);

const m: Mandala = {
  seeds: [{ rel: 'stone/Inbox.md', title: 'Inbox' }],
  petals: [
    { folder: 'Practice', notes: [1, 2, 3, 4].map((i) => ({ rel: `stone/Practice/${i}.md`, title: `${i}` })) },
    { folder: 'Reading', notes: [{ rel: 'stone/Reading/r.md', title: 'r' }] },
    { folder: 'Empty', notes: [] },
  ],
  grains: [
    { rel: 'sand/sun/new.md', title: 'new', life: 'sun', written: '', dissolves: '', fraction_left: 1 },
    { rel: 'sand/sun/old.md', title: 'old', life: 'sun', written: '', dissolves: '', fraction_left: 0.1 },
  ],
  links: [
    { from: 'sand/sun/new.md', to: 'stone/Reading/r.md' },
    { from: 'sand/sun/new.md', to: 'stone/gone.md' },
  ],
  dust: [
    { id: 'a', title: 'a', reason: 'swept', at: '', settled: 0 },
    { id: 'b', title: 'b', reason: 'swept', at: '', settled: 1 },
  ],
};

describe('mandala layout', () => {
  const l = layout(m);

  it('gives each stone folder a petal, evenly turned, with more notes reaching further', () => {
    expect(l.petals.map((p) => p.angle)).toEqual([0, 120, 240]);
    expect(l.petals[0].tip).toBeGreaterThan(l.petals[1].tip);
    expect(l.petals[2].tip).toBeGreaterThan(R.petalBase);
    for (const p of l.petals) expect(p.tip).toBeLessThanOrEqual(R.lotus);
  });

  it('keeps stone inside the lotus and sand between the lotus and the rim', () => {
    for (const s of [...l.seeds, ...l.petals.flatMap((p) => p.notes)]) expect(dist(s)).toBeLessThan(R.lotus);
    for (const g of l.grains) {
      expect(dist(g)).toBeGreaterThanOrEqual(R.sandIn - 0.5);
      expect(dist(g)).toBeLessThanOrEqual(R.rim + 0.5);
    }
  });

  it('moves sand outward as it ages, on a bearing that does not change', () => {
    expect(grainRadius(1)).toBe(R.sandIn);
    expect(grainRadius(0)).toBe(R.rim);
    expect(grainRadius(0.3)).toBeGreaterThan(grainRadius(0.7));
    expect(bearing('sand/sun/a.md')).toBe(bearing('sand/sun/a.md'));
    expect(bearing('sand/sun/a.md')).not.toBe(bearing('sand/sun/b.md'));
  });

  it('turns sand vermilion when it leaves soon, by the rail bars’ rule, but never a breath', () => {
    const now = new Date('2026-10-31T12:00:00Z');
    const inHours = (h: number) => new Date(now.getTime() + h * 3_600_000).toISOString();
    expect(grainColor({ life: 'sun', dissolves: inHours(2) }, now)).toBe('var(--vermilion)');
    expect(grainColor({ life: 'full', dissolves: inHours(2) }, now)).toBe('var(--vermilion)');
    expect(grainColor({ life: 'sun', dissolves: inHours(12) }, now)).toBe('var(--sand)');
    expect(grainColor({ life: 'breath', dissolves: null }, now)).toBe('var(--bone)');
  });

  it('draws only links between notes it placed', () => {
    expect(l.links).toHaveLength(1);
    expect(l.links[0].d.startsWith('M')).toBe(true);
  });

  it('puts dust past the rim, further and fainter as it settles', () => {
    const [fresh, old] = l.dust;
    expect(dist(fresh)).toBeGreaterThan(R.rim);
    expect(dist(old)).toBeGreaterThan(dist(fresh));
    expect(old.opacity).toBeLessThan(fresh.opacity);
  });
});
