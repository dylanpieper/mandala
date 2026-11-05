import { describe, expect, it } from 'vitest';
import { SandField } from './sand';

// A seeded random, so the sand behaves the same every run.
function seeded(seed = 7) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

const run = (f: SandField, seconds: number, blade: Parameters<SandField['step']>[1] = null) => {
  for (let t = 0; t < seconds; t += 1 / 60) f.step(1 / 60, blade);
};

describe('sand', () => {
  it('lands and comes to rest', () => {
    const f = new SandField(400, 300, seeded());
    f.pour(800, 1);
    run(f, 6);
    expect(f.grains.every((g) => g.z === 0)).toBe(true);
    const moving = f.grains.filter((g) => g.vx !== 0 || g.vy !== 0).length;
    expect(moving).toBeLessThan(f.grains.length * 0.05);
  });

  it('slumps: a heap spreads out rather than staying a point', () => {
    const f = new SandField(400, 300, seeded());
    for (let i = 0; i < 400; i++) f.grains.push({ x: 200, y: 150, vx: 0, vy: 0, z: 0, wait: 0, size: 1, color: 0 });
    run(f, 3);
    const spread = Math.max(...f.grains.map((g) => Math.hypot(g.x - 200, g.y - 150)));
    expect(spread).toBeGreaterThan(15);
  });

  it('a broom pushes sand ahead of it and off the page', () => {
    const f = new SandField(400, 300, seeded());
    for (let i = 0; i < 200; i++) f.grains.push({ x: 100 + (i % 20), y: 140 + Math.floor(i / 20), vx: 0, vy: 0, z: 0, wait: 0, size: 1, color: 0 });
    // A blade moving right along y = 145, from x = 60 off the right edge.
    for (let x = 60; x < 460; x += 600 / 60) f.step(1 / 60, { x, y: 145, dx: 1, dy: 0, speed: 600, half: 40 });
    run(f, 1);
    // Most goes off the edge; a little spills around the blade's ends, as with a real broom.
    expect(f.left).toBeLessThan(60);
  });

  it('a slow stroke pushes sand slowly, with no grain jumping ahead', () => {
    const f = new SandField(400, 300, seeded());
    for (let i = 0; i < 60; i++) f.grains.push({ x: 120 + (i % 6) * 2, y: 140 + Math.floor(i / 6) * 2, vx: 0, vy: 0, z: 0, wait: 0, size: 1, color: 0 });
    let worst = 0;
    // 30 px/s: half a pixel a frame, for three seconds.
    for (let k = 0, x = 100; k < 180; k++, x += 0.5) {
      const before = f.grains.map((g) => ({ x: g.x, y: g.y }));
      f.step(1 / 60, { x, y: 149, dx: 1, dy: 0, speed: 30, half: 40 });
      f.grains.forEach((g, i) => (worst = Math.max(worst, Math.hypot(g.x - before[i].x, g.y - before[i].y))));
    }
    expect(worst).toBeLessThan(6);
    // And the sand did move along with the blade.
    expect(Math.min(...f.grains.map((g) => g.x))).toBeGreaterThan(180);
    // Nothing slipped behind the blade (now at x = 190); spill goes to the sides.
    expect(f.grains.filter((g) => Math.abs(g.y - 149) < 40 && g.x < 190)).toHaveLength(0);
  });

  it('a broom held still is a wall: the heap before it never slumps through behind it', () => {
    const f = new SandField(400, 300, seeded());
    // A crowded heap just ahead of a blade at x = 100, facing right.
    for (let i = 0; i < 300; i++) f.grains.push({ x: 105 + (i % 5), y: 135 + Math.floor(i / 5) * 0.5, vx: 0, vy: 0, z: 0, wait: 0, size: 1, color: 0 });
    const blade = { x: 100, y: 150, dx: 1, dy: 0, speed: 0, half: 40 };
    run(f, 3, blade);
    const behind = f.grains.filter((g) => Math.abs(g.y - 150) < 40 && g.x < 100);
    expect(behind).toHaveLength(0);
  });

  it('scatters with speed: a slow push keeps the heap together, a fast one sprays it', () => {
    const spreadAfter = (speed: number) => {
      const f = new SandField(1200, 400, seeded(3));
      for (let i = 0; i < 200; i++) f.grains.push({ x: 120 + (i % 10) * 2, y: 190 + Math.floor(i / 10), vx: 0, vy: 0, z: 0, wait: 0, size: 1, color: 0 });
      // Push 300 px at the given speed, then let it settle.
      const per = speed / 60;
      for (let x = 100; x < 400; x += per) f.step(1 / 60, { x, y: 200, dx: 1, dy: 0, speed, half: 40 });
      run(f, 2);
      const ys = f.grains.map((g) => g.y);
      const mean = ys.reduce((a, b) => a + b, 0) / ys.length;
      return Math.sqrt(ys.reduce((a, y) => a + (y - mean) ** 2, 0) / ys.length);
    };
    const slow = spreadAfter(60);
    const fast = spreadAfter(1500);
    expect(fast).toBeGreaterThan(slow * 1.5);
  });

  it('leaves sand the broom did not touch', () => {
    const f = new SandField(400, 300, seeded());
    f.grains.push({ x: 50, y: 50, vx: 0, vy: 0, z: 0, wait: 0, size: 1, color: 0 });
    for (let x = 60; x < 460; x += 10) f.step(1 / 60, { x, y: 250, dx: 1, dy: 0, speed: 600, half: 30 });
    expect(f.left).toBe(1);
  });

  it('resizes with the page: every grain kept, spread over the new size', () => {
    const f = new SandField(400, 300, seeded());
    f.pour(800, 1);
    run(f, 4);
    const before = f.left;
    f.resize(660, 300);
    expect(f.width).toBe(660);
    expect(f.left).toBe(before);
    expect(Math.max(...f.grains.map((g) => g.x))).toBeGreaterThan(400);
    // Smaller than before: no grain is left off the page, where no broom reaches.
    f.resize(200, 150);
    run(f, 1);
    expect(f.left).toBe(before);
    expect(f.grains.every((g) => g.x >= 0 && g.x <= 200 && g.y >= 0 && g.y <= 150)).toBe(true);
  });
});
