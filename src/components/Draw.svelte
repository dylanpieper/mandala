<script lang="ts">
  // A sheet to draw on, over the page. Saved as SVG beside the notes, so
  // Obsidian shows it with no plugin; each stroke is one `<path>`, so a
  // drawing opens again to change. Any pen color and size, a sheet color
  // (or none), an eraser that lifts whole strokes, ⌘Z to undo. Done saves,
  // Esc leaves it as it was.
  import { onDestroy, onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { readPicture, savePicture } from '../lib/api';
  import { modHeld } from '../lib/keys';
  import { hold } from '../lib/hold';
  import { stampedName } from '../editor/pictures';
  import Icon from './Icon.svelte';
  import { TIPS, brushPath, type Tip } from '../lib/tips';

  let {
    name,
    onDone,
    onCancel,
    onDelete,
  }: { name: string | null; onDone: (name: string, isNew: boolean) => void; onCancel: () => void; onDelete: (name: string) => void } = $props();

  // A stroke and its tip. A brush stroke's `d` is a filled outline; the rest are lines.
  type Stroke = { d: string; color: string; width: number; tip: Tip };
  type Point = { x: number; y: number; pressure: number };

  const INKS = [
    { label: 'Bone', color: '#ece6da' },
    { label: 'Sand', color: '#d9ae6c' },
    { label: 'Stone', color: '#a9bcc6' },
    { label: 'Vermilion', color: '#d9653f' },
  ];
  const PEN = 2.5;
  /** The sheet's ground when none is chosen: drawn on screen, not saved. */
  const BARE = '#18171b';

  let host: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let tools: HTMLDivElement | undefined;
  // The page under the sheet changes size when a rail opens or shuts, and with the window.
  let observer: ResizeObserver | undefined;
  let rect = $state({ left: 0, top: 0, width: 0, height: 0 });
  let sheet = $state({ w: 800, h: 500 });
  let scale = $state(1);
  let strokes = $state<Stroke[]>([]);
  let undo: Stroke[][] = [];
  let ink = $state(INKS[0].color);
  let size = $state(PEN);
  // The sheet's color, saved as a rect behind the strokes; null is clear.
  let ground = $state<string | null>(null);
  let erasing = $state(false);
  let saving = $state(false);
  let tip = $state<Tip>('pen');
  const TIP_NAMES: { tip: Tip; label: string }[] = [
    { tip: 'pen', label: 'Pen' },
    { tip: 'brush', label: 'Brush' },
    { tip: 'marker', label: 'Highlighter' },
    { tip: 'pencil', label: 'Pencil' },
  ];
  let points: Point[] | null = null;

  /** The stroke being drawn, as it will be saved. */
  function current(done = false): Stroke | null {
    if (!points) return null;
    if (tip === 'brush') return { d: brushPath(points, size, done), color: ink, width: size, tip };
    return { d: pathOf(points.map((p) => [p.x, p.y])), color: ink, width: TIPS[tip].width(size), tip };
  }

  function measure() {
    const r = (host.parentElement ?? host).getBoundingClientRect();
    rect = { left: r.left, top: r.top, width: r.width, height: r.height };
    // The sheet fits the page with room for the tools below it, on one line or two.
    const below = (tools?.offsetHeight ?? 40) + 18;
    scale = Math.max(0.2, Math.min((r.width - 64) / sheet.w, (r.height - below - 64) / sheet.h, 1.6));
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(sheet.w * scale * dpr);
    canvas.height = Math.round(sheet.h * scale * dpr);
    draw();
  }

  /** A smooth path through the points: quadratic curves between midpoints. */
  function pathOf(p: [number, number][]): string {
    const f = (n: number) => Math.round(n * 10) / 10;
    if (p.length === 1) return `M${f(p[0][0])} ${f(p[0][1])}l0.1 0`;
    let d = `M${f(p[0][0])} ${f(p[0][1])}`;
    for (let i = 1; i < p.length - 1; i++) {
      const mx = (p[i][0] + p[i + 1][0]) / 2;
      const my = (p[i][1] + p[i + 1][1]) / 2;
      d += `Q${f(p[i][0])} ${f(p[i][1])} ${f(mx)} ${f(my)}`;
    }
    const last = p[p.length - 1];
    return `${d}L${f(last[0])} ${f(last[1])}`;
  }

  function context() {
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    return ctx;
  }

  function draw() {
    if (!canvas) return;
    const ctx = context();
    ctx.clearRect(0, 0, sheet.w, sheet.h);
    const now = current();
    for (const s of now ? [...strokes, now] : strokes) {
      const path = new Path2D(s.d);
      if (s.tip === 'brush') {
        ctx.globalAlpha = 1;
        ctx.fillStyle = s.color;
        ctx.fill(path);
        continue;
      }
      const look = TIPS[s.tip];
      ctx.globalAlpha = look.opacity;
      ctx.lineCap = look.cap;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.stroke(path);
    }
    ctx.globalAlpha = 1;
    ctx.lineCap = 'round';
  }

  const at = (e: PointerEvent): [number, number] => {
    const r = canvas.getBoundingClientRect();
    return [(e.clientX - r.left) / scale, (e.clientY - r.top) / scale];
  };

  function eraseAt(e: PointerEvent) {
    const ctx = context();
    const r = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const x = (e.clientX - r.left) * dpr;
    const y = (e.clientY - r.top) * dpr;
    // A brush stroke is a shape: it is touched inside it, or near its edge.
    const touched = (s: Stroke) => {
      const path = new Path2D(s.d);
      ctx.lineWidth = s.tip === 'brush' ? 14 : Math.max(14, s.width);
      return (s.tip === 'brush' && ctx.isPointInPath(path, x, y)) || ctx.isPointInStroke(path, x, y);
    };
    const kept = strokes.filter((s) => !touched(s));
    if (kept.length !== strokes.length) {
      strokes = kept;
      draw();
    }
  }

  function down(e: PointerEvent) {
    canvas.setPointerCapture(e.pointerId);
    undo.push(strokes);
    if (erasing) return eraseAt(e);
    points = [point(e)];
    draw();
  }
  /** A point of the stroke. Only a pen's pressure counts; a mouse reports a fixed one. */
  function point(e: PointerEvent): Point {
    const [x, y] = at(e);
    return { x, y, pressure: e.pointerType === 'pen' ? e.pressure : 0 };
  }
  function move(e: PointerEvent) {
    if (!(e.buttons & 1)) return;
    if (erasing) return eraseAt(e);
    if (!points) return;
    const all = e.getCoalescedEvents?.() ?? [e];
    for (const c of all.length ? all : [e]) points.push(point(c as PointerEvent));
    draw();
  }
  function up() {
    const done = current(true);
    if (done) {
      strokes = [...strokes, done];
      points = null;
    }
    // A press that changed nothing leaves nothing to undo.
    if (undo.length && undo[undo.length - 1] === strokes) undo.pop();
    draw();
  }

  function back() {
    const prev = undo.pop();
    if (prev) {
      strokes = prev;
      draw();
    }
  }

  function svg(): string {
    const esc = (s: string) => s.replace(/[<>&"]/g, '');
    const paths = strokes.map((s) => {
      if (s.tip === 'brush') return `  <path d="${esc(s.d)}" fill="${esc(s.color)}" stroke="none" data-tip="brush" data-size="${s.width}"/>`;
      const look = TIPS[s.tip];
      const alpha = look.opacity < 1 ? ` stroke-opacity="${look.opacity}"` : '';
      return `  <path d="${esc(s.d)}" fill="none" stroke="${esc(s.color)}" stroke-width="${s.width}"${alpha} stroke-linecap="${look.cap}" stroke-linejoin="round" data-tip="${s.tip}"/>`;
    });
    const back = ground ? `  <rect width="${sheet.w}" height="${sheet.h}" fill="${esc(ground)}" data-mandala="ground"/>\n` : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sheet.w} ${sheet.h}" width="${sheet.w}" height="${sheet.h}" data-mandala="drawing">\n${back}${paths.join('\n')}\n</svg>\n`;
  }

  async function done() {
    if (saving) return;
    if (!name && !strokes.length) return onCancel();
    saving = true;
    const bytes = new TextEncoder().encode(svg());
    const saved = name ? await savePicture(name, bytes, true) : await savePicture(stampedName('Drawing', 'svg'), bytes);
    onDone(saved, !name);
  }

  function key(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onCancel();
    } else if (modHeld(e) && e.key === 'z') {
      e.preventDefault();
      back();
    } else if (modHeld(e) && e.key === 'Enter') {
      e.preventDefault();
      done();
    }
  }

  async function load(n: string) {
    const bytes = await readPicture(n).catch(() => null);
    if (!bytes) return;
    const doc = new DOMParser().parseFromString(new TextDecoder().decode(bytes), 'image/svg+xml');
    const root = doc.documentElement;
    const box = root.getAttribute('viewBox')?.split(/[\s,]+/).map(Number);
    if (box && box.length === 4 && box[2] > 0 && box[3] > 0) sheet = { w: box[2], h: box[3] };
    ground = doc.querySelector('rect[data-mandala="ground"]')?.getAttribute('fill') ?? null;
    // A path's tip is in `data-tip`; a filled path from elsewhere is read as a brush, any other as a pen.
    const tipOf = (p: Element): Tip => {
      const t = p.getAttribute('data-tip');
      if (t === 'brush' || t === 'marker' || t === 'pencil' || t === 'pen') return t;
      const fill = p.getAttribute('fill');
      return fill && fill !== 'none' ? 'brush' : 'pen';
    };
    strokes = [...doc.querySelectorAll('path')].map((p) => {
      const t = tipOf(p);
      return {
        d: p.getAttribute('d') ?? '',
        color: (t === 'brush' ? p.getAttribute('fill') : p.getAttribute('stroke')) ?? INKS[0].color,
        width: Number(p.getAttribute(t === 'brush' ? 'data-size' : 'stroke-width')) || PEN,
        tip: t,
      };
    }).filter((s) => s.d);
    measure();
  }

  onMount(() => {
    measure();
    if (name) load(name);
    observer = new ResizeObserver(() => measure());
    observer.observe(host.parentElement ?? host);
    if (tools) observer.observe(tools);
  });
  onDestroy(() => observer?.disconnect());
</script>

<svelte:window onkeydown={key} />

<div class="draw" bind:this={host} style="left: {rect.left}px; top: {rect.top}px; width: {rect.width}px; height: {rect.height}px" transition:fade={{ duration: 260 }}>
  <canvas
    bind:this={canvas}
    class:erasing
    style="width: {sheet.w * scale}px; height: {sheet.h * scale}px; background: {ground ?? BARE}"
    onpointerdown={down}
    onpointermove={move}
    onpointerup={up}
    onpointercancel={up}
    aria-label="Drawing sheet"
  ></canvas>
  <div class="tools" role="toolbar" aria-label="Drawing" bind:this={tools}>
    {#each TIP_NAMES as t}
      <button class="tool" class:on={!erasing && tip === t.tip} aria-label={t.label} aria-pressed={!erasing && tip === t.tip} title={t.label} onclick={() => ((tip = t.tip), (erasing = false))}><Icon name={t.tip} /></button>
    {/each}
    <span class="rule" aria-hidden="true"></span>
    {#each INKS as i}
      <button class="ink" class:on={!erasing && ink === i.color} style="--ink: {i.color}" aria-label={i.label} aria-pressed={!erasing && ink === i.color} onclick={() => ((ink = i.color), (erasing = false))}></button>
    {/each}
    <!-- Any other ink, from the system's color picker. -->
    <label class="ink any" class:on={!erasing && !INKS.some((i) => i.color === ink)} style="--ink: {ink}" title="Any color">
      <input type="color" bind:value={ink} oninput={() => (erasing = false)} aria-label="Pen color" />
    </label>
    <span class="rule" aria-hidden="true"></span>
    <label class="size" title="Pen size">
      <span class="dot" style="width: {Math.max(2, size * scale)}px; height: {Math.max(2, size * scale)}px; background: {ink}" aria-hidden="true"></span>
      <input type="range" min="1" max="24" step="0.5" bind:value={size} aria-label="Pen size" />
    </label>
    <span class="rule" aria-hidden="true"></span>
    <label class="ground" class:clear={!ground} style="--ground: {ground ?? 'transparent'}" title="Sheet color">
      <input type="color" value={ground ?? '#ece6da'} oninput={(e) => (ground = e.currentTarget.value)} aria-label="Sheet color" />
    </label>
    {#if ground}
      <button class="tool small" aria-label="Clear sheet color" title="Clear sheet color" onclick={() => (ground = null)} transition:fade={{ duration: 160 }}><Icon name="close" size={14} /></button>
    {/if}
    <button class="tool" class:on={erasing} aria-label="Eraser" aria-pressed={erasing} title="Eraser" onclick={() => (erasing = !erasing)}><Icon name="eraser" /></button>
    <span class="gap"></span>
    {#if name}
      <!-- A saved drawing is let go like a note: held, and it rests for a day. -->
      <button class="pill sand" aria-label="Hold to let go of this drawing" use:hold={{ done: () => onDelete(name!) }}><Icon name="wind" />Let go</button>
    {/if}
    <button class="pill" onclick={onCancel}><Icon name="close" />Cancel</button>
    <button class="pill stone" disabled={saving} onclick={done}><Icon name="check" />Done</button>
  </div>
</div>

<style>
  .draw {
    position: fixed;
    z-index: 6;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 18px;
    background: rgb(14 13 16 / 0.86);
    backdrop-filter: blur(6px);
  }
  canvas {
    display: block;
    background: var(--raised);
    border: 1px solid var(--line);
    border-radius: 14px;
    box-shadow: 0 18px 48px rgb(0 0 0 / 0.45);
    cursor: crosshair;
    touch-action: none;
  }
  canvas.erasing {
    cursor: cell;
  }
  /* In a narrow page the tools wrap onto a second line, never past the page's edges. */
  .tools {
    max-width: calc(100% - 32px);
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: 10px;
  }
  .ink {
    width: 18px;
    height: 18px;
    padding: 0;
    border-radius: 50%;
    border: 2px solid transparent;
    background: var(--ink);
    background-clip: content-box;
    outline: 1px solid transparent;
    outline-offset: 2px;
    transition: outline-color var(--quick) var(--ease), transform var(--quick) var(--ease);
  }
  .ink:hover {
    transform: scale(1.1);
  }
  .ink.on {
    outline-color: var(--ink);
  }
  .tool {
    width: 28px;
    height: 28px;
    padding: 0;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--ash);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: background var(--quick) var(--ease), color var(--quick) var(--ease);
  }
  .tool:hover,
  .tool.on {
    background: var(--hover);
    color: var(--bone);
  }
  .gap {
    width: 18px;
  }
  .rule {
    width: 1px;
    height: 18px;
    background: var(--line);
  }
  /* A color input, drawn as a swatch: the picker opens on a click. */
  .any,
  .ground {
    position: relative;
    cursor: pointer;
  }
  .any input,
  .ground input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }
  .any {
    background: conic-gradient(#d9653f, #d9ae6c, #5aae88, #5b82cf, #a9bcc6, #d9653f);
    background-clip: content-box;
  }
  .any.on {
    outline-color: var(--ink);
  }
  .ground {
    width: 22px;
    height: 16px;
    border-radius: 4px;
    border: 1px solid var(--line-strong);
    background: var(--ground);
  }
  /* No sheet color: a diagonal line through an empty swatch. */
  .ground.clear {
    background: linear-gradient(to top right, transparent calc(50% - 0.7px), var(--dust) 50%, transparent calc(50% + 0.7px));
  }
  .size {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .dot {
    flex: none;
    border-radius: 50%;
    transition: width var(--quick) var(--ease), height var(--quick) var(--ease);
  }
  .size input {
    -webkit-appearance: none;
    appearance: none;
    width: 84px;
    height: 16px;
    background: transparent;
    margin: 0;
  }
  .size input::-webkit-slider-runnable-track {
    height: 2px;
    border-radius: 2px;
    background: var(--line-strong);
  }
  .size input::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 12px;
    height: 12px;
    margin-top: -5px;
    border-radius: 50%;
    background: var(--bone);
  }
  .tool.small {
    width: 20px;
    height: 20px;
    margin-left: -6px;
  }
  .pill {
    height: 30px;
  }
</style>
