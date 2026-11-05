import { describe, expect, it } from 'vitest';
import { brushPath, nibPressure } from './tips';

describe('nibPressure', () => {
  it('is high across the nib and low along it, as a calligraphy pen', () => {
    // The nib lies at 45°: a stroke at -45° crosses it, one at 45° runs along it.
    const pts = (dx: number, dy: number) => Array.from({ length: 10 }, (_, i) => ({ x: i * dx, y: i * dy, pressure: 0 }));
    const across = nibPressure(pts(1, -1))[5];
    const along = nibPressure(pts(1, 1))[5];
    expect(across).toBeGreaterThan(along * 2);
  });

  it('follows a pen pressure when there is one', () => {
    const line = (p: number) => Array.from({ length: 10 }, (_, i) => ({ x: i * 4, y: 0, pressure: p }));
    expect(nibPressure(line(1))[5]).toBeGreaterThan(nibPressure(line(0.3))[5]);
  });
});

describe('brushPath', () => {
  it('is one closed, smooth shape', () => {
    const line = Array.from({ length: 40 }, (_, i) => ({ x: i * 3, y: Math.sin(i / 5) * 20, pressure: 0 }));
    const d = brushPath(line, 8, true);
    expect(d).toMatch(/^M[\d.,-]+ Q/);
    expect(d.endsWith('Z')).toBe(true);
  });

  it('is a dot for a single press', () => {
    expect(brushPath([{ x: 5, y: 5, pressure: 0 }], 8, true)).toMatch(/^M.*Z$/);
  });
});
