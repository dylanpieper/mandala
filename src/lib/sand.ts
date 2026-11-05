// Sand on a page, seen from above, for `SandFall.svelte`. Pure and stepped by
// the caller, so it is tested (`sand.test.ts`).
//
// - Pouring: grains fall from a few drifting points toward the viewer's page,
//   land with a short skid, and gather in mounds.
// - Slumping: where grains crowd a cell past what it holds, they slide toward
//   emptier neighbours, so mounds spread into a natural, soft-edged heap and
//   stop when they are stable (the angle of repose, from above).
// - The broom is a plough: a short blade across the stroke. Grains it meets
//   are carried at its speed and heap up in front of it; the heap slumps and
//   spills around the blade's ends. Grains pushed off the page are gone.
// - Friction stops loose grains quickly, as dry sand does.

export interface Grain {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Height above the page while falling: 1 when it starts, 0 on landing. */
  z: number;
  /** Seconds before it starts to fall. */
  wait: number;
  size: number;
  color: number;
}

export interface Blade {
  x: number;
  y: number;
  /** Unit vector of the stroke. */
  dx: number;
  dy: number;
  /** Speed along the stroke, px/s. */
  speed: number;
  /** Half the blade's length, across the stroke. */
  half: number;
}

const CELL = 5;
const HOLDS = 4; // grains a cell holds before they slide
// Slumping is a creep, not a throw: with friction it settles near
// SLUMP * crowd / FRICTION px/s, about 10 px/s per grain of crowding.
const SLUMP = 90; // px/s² per grain of crowding
/** Spray from the blade grows with the square of its speed (kinetic energy): px/s of scatter at 1000 px/s. */
const SPRAY_AT_1000 = 140;
const FRICTION = 9; // 1/s
const FALL_S = 0.55;
/** The blade's face is this far ahead of the pointer; it catches grains up to BLADE_BACK behind (more than one step of the blade). */
export const BLADE_FRONT = 4;
export const BLADE_BACK = 8;

export class SandField {
  grains: Grain[] = [];
  width: number;
  height: number;
  private cols: number;
  private rows: number;
  private count: Uint16Array;
  private rand: () => number;

  constructor(width: number, height: number, rand: () => number = Math.random) {
    this.width = width;
    this.height = height;
    this.cols = Math.max(1, Math.ceil(width / CELL));
    this.rows = Math.max(1, Math.ceil(height / CELL));
    this.count = new Uint16Array(this.cols * this.rows);
    this.rand = rand;
  }

  /**
   * The page changed size (a rail opened or shut, the window moved). The sand
   * stretches with it, so it still covers the whole page and no grain is left
   * past an edge where the broom cannot reach.
   */
  resize(width: number, height: number) {
    if (width <= 0 || height <= 0 || (width === this.width && height === this.height)) return;
    const sx = width / this.width;
    const sy = height / this.height;
    for (const g of this.grains) {
      g.x = Math.min(width, Math.max(0, g.x * sx));
      g.y = Math.min(height, Math.max(0, g.y * sy));
    }
    this.width = width;
    this.height = height;
    this.cols = Math.max(1, Math.ceil(width / CELL));
    this.rows = Math.max(1, Math.ceil(height / CELL));
    this.count = new Uint16Array(this.cols * this.rows);
  }

  private gauss() {
    const u = Math.max(1e-9, this.rand());
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * this.rand());
  }

  /** Pour `n` grains over `seconds`, from a few points across the page. */
  pour(n: number, seconds = 1.6, colors = 1) {
    const { width: w, height: h } = this;
    const points = Array.from({ length: 3 + Math.floor(this.rand() * 3) }, () => ({
      x: w * (0.15 + 0.7 * this.rand()),
      y: h * (0.25 + 0.6 * this.rand()),
      spread: 30 + this.rand() * 70,
    }));
    for (let i = 0; i < n; i++) {
      let x: number;
      let y: number;
      if (this.rand() < 0.18) {
        // A light sprinkle everywhere, as sand never lands only in heaps.
        x = this.rand() * w;
        y = this.rand() * h;
      } else {
        const p = points[Math.floor(this.rand() * points.length)];
        x = p.x + this.gauss() * p.spread;
        y = p.y + this.gauss() * p.spread * 0.8;
      }
      this.grains.push({
        x,
        y,
        vx: 0,
        vy: 0,
        z: 1,
        wait: this.rand() * seconds,
        size: 0.8 + this.rand() * 1.4,
        color: Math.floor(this.rand() * colors),
      });
    }
  }

  private cell(x: number, y: number) {
    const cx = Math.min(this.cols - 1, Math.max(0, Math.floor(x / CELL)));
    const cy = Math.min(this.rows - 1, Math.max(0, Math.floor(y / CELL)));
    return cy * this.cols + cx;
  }

  private at(cx: number, cy: number) {
    if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) return 0;
    return this.count[cy * this.cols + cx];
  }

  /** Grains on the page (landed, or still to land). */
  get left(): number {
    return this.grains.length;
  }

  step(dt: number, blade: Blade | null = null) {
    dt = Math.min(dt, 1 / 30);
    this.count.fill(0);
    for (const g of this.grains) if (g.z === 0) this.count[this.cell(g.x, g.y)]++;

    for (const g of this.grains) {
      if (g.wait > 0) {
        g.wait -= dt;
        continue;
      }
      if (g.z > 0) {
        g.z = Math.max(0, g.z - dt / FALL_S);
        if (g.z === 0) {
          // A short skid on landing, in any direction.
          const a = this.rand() * Math.PI * 2;
          const s = 20 + this.rand() * 50;
          g.vx = Math.cos(a) * s;
          g.vy = Math.sin(a) * s;
        }
        continue;
      }

      // Slump: slide away from crowding, toward the emptier side.
      const cx = Math.floor(g.x / CELL);
      const cy = Math.floor(g.y / CELL);
      const crowd = this.at(cx, cy) - HOLDS;
      if (crowd > 0) {
        const gx = this.at(cx - 1, cy) - this.at(cx + 1, cy);
        const gy = this.at(cx, cy - 1) - this.at(cx, cy + 1);
        const len = Math.hypot(gx, gy);
        const a = this.rand() * Math.PI * 2;
        const ux = len ? gx / len : Math.cos(a);
        const uy = len ? gy / len : Math.sin(a);
        const push = SLUMP * Math.min(crowd, 4) * dt;
        let px = (ux + (this.rand() - 0.5) * 0.3) * push;
        let py = (uy + (this.rand() - 0.5) * 0.3) * push;
        // Against the blade's face a heap piles up rather than out: there it
        // may only slide forward, ahead of the stroke, never sideways or back.
        if (blade && this.faces(g, blade)) {
          const fwd = Math.max(0, px * blade.dx + py * blade.dy);
          px = fwd * blade.dx;
          py = fwd * blade.dy;
        }
        g.vx += px;
        g.vy += py;
      }

      if (blade) this.plough(g, blade);

      const f = Math.exp(-FRICTION * dt);
      g.vx *= f;
      g.vy *= f;
      if (Math.abs(g.vx) + Math.abs(g.vy) < 1.5) {
        g.vx = 0;
        g.vy = 0;
      }
      g.x += g.vx * dt;
      g.y += g.vy * dt;
    }

    // Off the page is gone.
    const m = 4;
    this.grains = this.grains.filter((g) => g.z > 0 || g.wait > 0 || (g.x > -m && g.x < this.width + m && g.y > -m && g.y < this.height + m));
  }

  /** Is the grain in the heap against the blade's face? */
  private faces(g: Grain, b: Blade) {
    const rx = g.x - b.x;
    const ry = g.y - b.y;
    const along = rx * b.dx + ry * b.dy;
    const across = -rx * b.dy + ry * b.dx;
    return along >= -BLADE_BACK && along < BLADE_FRONT + 16 && Math.abs(across) <= b.half;
  }

  /** The blade carries what it meets at its own speed, heaped just ahead. */
  private plough(g: Grain, b: Blade) {
    const rx = g.x - b.x;
    const ry = g.y - b.y;
    const along = rx * b.dx + ry * b.dy;
    const across = -rx * b.dy + ry * b.dx;
    // Only grains the blade has reached: from just behind it (it moves at
    // most BLADE_BACK per step, so none slip under) to its front face.
    if (along < -BLADE_BACK || along >= BLADE_FRONT || Math.abs(across) > b.half) return;
    // Moved only as far as the face, never further: at any speed the heap
    // moves exactly with the blade, with no jump. Grains already ahead wait
    // until the blade reaches them.
    const to = BLADE_FRONT + this.rand() * 1.5;
    g.x += (to - along) * b.dx;
    g.y += (to - along) * b.dy;
    // Carried no faster than the blade, so a slow stroke is a slow push;
    // a grain already moving faster keeps its speed.
    const own = g.vx * b.dx + g.vy * b.dy;
    if (own >= b.speed) return;
    // A slow push carries the heap as one; speed throws grains loose. Both the
    // spill around the ends and the spray grow with speed, the spray with its
    // square, so at a crawl there is almost none.
    const pace = Math.min(1, b.speed / 1000);
    const spill = (across / b.half) * 0.3 * pace;
    const spray = SPRAY_AT_1000 * pace * pace;
    // Within about 60° of the stroke, opening to about 75° at full speed,
    // and a fast stroke throws a few grains a little farther: subtle, and
    // nothing at a crawl.
    const a = (this.rand() - 0.5) * (2.1 + 0.5 * pace);
    const sx = Math.cos(a) * b.dx - Math.sin(a) * b.dy;
    const sy = Math.sin(a) * b.dx + Math.cos(a) * b.dy;
    const r = Math.pow(this.rand(), 1 - 0.25 * pace) * spray;
    g.vx = b.dx * b.speed - b.dy * spill * b.speed + sx * r;
    g.vy = b.dy * b.speed + b.dx * spill * b.speed + sy * r;
  }
}
