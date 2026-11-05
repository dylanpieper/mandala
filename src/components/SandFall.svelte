<script lang="ts">
  // Sand settling over a note that leaves soon (physics in `lib/sand.ts`). It
  // pours when the note opens and lies over the page until swept: drag across
  // it like a broom, or hold Sweep for one long stroke across the page. The
  // note beneath never changes. Once nearly all of it is gone the rest fades
  // and `onSwept` runs. With reduced motion there is no sand at all.
  import { onDestroy, onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import Icon from './Icon.svelte';
  import { hold } from '../lib/hold';
  import { SandField, type Blade } from '../lib/sand';

  let { onSwept }: { onSwept: () => void } = $props();

  let host: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let rect = $state({ left: 0, top: 0, width: 0, height: 0 });
  let gone = $state(false);

  const COLORS = ['#d9ae6c', '#d9ae6c', '#d9ae6c', '#c9a063', '#c9a063', '#e6c48c', '#b88d55', '#d9653f'];
  const COUNT = 3600;
  const BLADE_HALF = 42;
  const STEP_PX = 6; // the blade moves at most this far per physics step, so it never skips grains

  let field: SandField;
  let frame = 0;
  let last = 0;
  // Blade positions the pointer passed through since the last frame.
  let strokes: { x: number; y: number; t: number }[] = [];
  let prev: { x: number; y: number; t: number } | null = null;
  let sweepAt: number | null = null; // the long stroke of Sweep: its x, or null
  // The broom's smoothed speed (px/s) and direction during a stroke.
  let speed = 0;
  let dir: { x: number; y: number } | null = null;
  // Where the broom last was, while it is held.
  let resting: Blade | null = null;

  // The page under the sand: it changes size when a rail opens or shuts (over
  // the rail's transition) and when the window does.
  let observer: ResizeObserver | undefined;

  function measure() {
    const r = (host.parentElement ?? host).getBoundingClientRect();
    rect = { left: r.left, top: r.top, width: r.width, height: r.height };
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    canvas.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Setting the size clears the canvas, and this runs after the frame's
    // drawing: draw again now, or the page shows bare for a frame.
    if (field) {
      field.resize(r.width, r.height);
      draw();
    }
  }

  /** Step the sand through one frame, with the blade wherever it went. */
  function advance(dt: number) {
    if (sweepAt !== null) {
      const speed = 1100;
      const blade = (x: number): Blade => ({ x, y: rect.height / 2, dx: 1, dy: 0, speed, half: rect.height / 2 + 30 });
      const to = sweepAt + speed * dt;
      const n = Math.max(1, Math.ceil((to - sweepAt) / STEP_PX));
      for (let i = 1; i <= n; i++) field.step(dt / n, blade(sweepAt + ((to - sweepAt) * i) / n));
      sweepAt = to > rect.width + 60 ? null : to;
      return;
    }
    if (prev && strokes.length) {
      let at = prev;
      const pieces: Blade[] = [];
      for (const p of strokes) {
        const dx = p.x - at.x;
        const dy = p.y - at.y;
        const len = Math.hypot(dx, dy);
        if (len < 1) continue; // gather tiny moves, so a slow hand gives a steady blade
        // Speed and angle are smoothed: pointer events are uneven, a real broom is not.
        const raw = len / Math.max(0.004, (p.t - at.t) / 1000);
        speed = Math.min(2400, speed ? speed * 0.7 + raw * 0.3 : raw);
        const k = dir ? Math.min(1, len / 14) : 1;
        const ux = (dir?.x ?? 0) * (1 - k) + (dx / len) * k;
        const uy = (dir?.y ?? 0) * (1 - k) + (dy / len) * k;
        const ul = Math.hypot(ux, uy) || 1;
        dir = { x: ux / ul, y: uy / ul };
        const n = Math.ceil(len / STEP_PX);
        for (let i = 1; i <= n; i++) pieces.push({ x: at.x + (dx * i) / n, y: at.y + (dy * i) / n, dx: dir.x, dy: dir.y, speed, half: BLADE_HALF });
        at = p;
      }
      prev = at;
      strokes = [];
      if (pieces.length) {
        for (const b of pieces) field.step(dt / pieces.length, b);
        resting = pieces[pieces.length - 1];
        return;
      }
    }
    // A held broom stays a wall while the hand pauses, so the heap cannot
    // slump back through it. It slows to a stop rather than pushing on.
    if (prev && resting) {
      resting = { ...resting, speed: resting.speed * 0.6 };
      field.step(dt, resting);
      return;
    }
    field.step(dt);
  }

  function draw() {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, rect.width, rect.height);
    for (const g of field.grains) {
      if (g.wait > 0) continue;
      // Falling grains are nearer the eye: larger and fainter until they land.
      const s = g.size * (1 + g.z * 1.6);
      ctx.globalAlpha = 0.85 - g.z * 0.55;
      ctx.fillStyle = COLORS[g.color];
      ctx.fillRect(g.x - s / 2, g.y - s / 2, s, s);
    }
  }

  function loop(t: number) {
    const dt = last ? (t - last) / 1000 : 0;
    last = t;
    advance(dt);
    draw();
    if (!gone && field.left < COUNT * 0.2) {
      gone = true;
      setTimeout(onSwept, 600);
    }
    frame = requestAnimationFrame(loop);
  }

  const local = (e: PointerEvent) => ({ x: e.clientX - rect.left, y: e.clientY - rect.top, t: e.timeStamp });

  function down(e: PointerEvent) {
    if (gone) return;
    canvas.setPointerCapture(e.pointerId);
    prev = local(e);
    strokes = [];
    speed = 0;
    dir = null;
  }
  function move(e: PointerEvent) {
    if (!prev) return;
    // Coalesced events keep a fast stroke smooth.
    const all = e.getCoalescedEvents?.() ?? [e];
    for (const c of all.length ? all : [e]) strokes.push(local(c as PointerEvent));
  }
  function up() {
    prev = null;
    strokes = [];
    resting = null;
  }

  function sweepAll() {
    if (!gone && sweepAt === null) sweepAt = -40;
  }

  onMount(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onSwept();
      return;
    }
    measure();
    field = new SandField(rect.width, rect.height);
    field.pour(COUNT, 1.8, COLORS.length);
    frame = requestAnimationFrame(loop);
    observer = new ResizeObserver(measure);
    observer.observe(host.parentElement ?? host);
  });
  onDestroy(() => {
    cancelAnimationFrame(frame);
    observer?.disconnect();
  });
</script>

<div class="sandfall" bind:this={host} style="left: {rect.left}px; top: {rect.top}px; width: {rect.width}px; height: {rect.height}px" out:fade={{ duration: 300 }}>
  <canvas bind:this={canvas} class:gone onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up} aria-hidden="true"></canvas>
  {#if !gone}
    <button class="pill sand" aria-label="Hold to sweep" use:hold={{ done: sweepAll }} transition:fade={{ duration: 320 }}><Icon name="broom" />Sweep</button>
  {/if}
</div>

<style>
  .sandfall {
    position: fixed;
    z-index: 4;
  }
  canvas {
    width: 100%;
    height: 100%;
    display: block;
    cursor: grab;
    touch-action: none;
    transition: opacity 600ms var(--ease);
  }
  canvas:active {
    cursor: grabbing;
  }
  canvas.gone {
    opacity: 0;
    pointer-events: none;
  }
  .pill {
    position: absolute;
    left: 50%;
    bottom: 24px;
    transform: translateX(-50%);
    height: 30px;
  }
</style>
