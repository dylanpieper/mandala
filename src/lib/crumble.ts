// A note let go crumbles into sand: each visible glyph becomes a few grains
// in its own place and color, which drift off on a soft wind and thin out.
// The words fade beneath the grains in the same moment, so nothing jumps.
// With reduced motion there are no grains, only a fade.
//
// `crumble` resolves once most of the sand has blown, with `end`: call it once the
// screen has moved on (the note gone from the page and the rail), to give the
// elements back their own look if they are still there.

export type Tone = 'sand' | 'stone';

const TONES: Record<Tone, string[]> = {
  sand: ['#d9ae6c', '#d9ae6c', '#c9a063', '#e6c48c', '#b88d55', '#d9653f'],
  stone: ['#a9bcc6', '#a9bcc6', '#93a7b2', '#c3d1d8', '#7f929c'],
};
const MAX_GRAINS = 4200;
const SECONDS = 2.2;
const FADE_MS = 90;
const HOLD = 0.12;
// The rows close up once most of the sand has blown, so the two never clash.
const CLEAR = 1.4;
const MAX_DELAY = 0.8;

interface Grain {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  delay: number;
}

/** The box of each visible glyph under `el`, with the color it is drawn in. */
export function glyphs(el: Element, view: { width: number; height: number }): { rect: DOMRect; color: string }[] {
  const out: { rect: DOMRect; color: string }[] = [];
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let node = walk.nextNode() as Text | null; node; node = walk.nextNode() as Text | null) {
    const parent = node.parentElement;
    if (!parent) continue;
    const style = getComputedStyle(parent);
    if (style.visibility === 'hidden' || style.opacity === '0') continue;
    const text = node.data;
    for (let i = 0; i < text.length; i++) {
      if (/\s/.test(text[i])) continue;
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      const rect = range.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      if (rect.bottom < 0 || rect.top > view.height || rect.right < 0 || rect.left > view.width) continue;
      out.push({ rect, color: style.color });
    }
  }
  return out;
}

function grainsFor(els: Element[], tone: Tone): Grain[] {
  const view = { width: innerWidth, height: innerHeight };
  const boxes = els.flatMap((el) => glyphs(el, view));
  if (!boxes.length) return [];
  const each = Math.max(1, Math.min(9, Math.floor(MAX_GRAINS / boxes.length)));
  const palette = TONES[tone];
  const left = Math.min(...boxes.map((b) => b.rect.left));
  const width = Math.max(1, Math.max(...boxes.map((b) => b.rect.right)) - left);
  const grains: Grain[] = [];
  for (const { rect, color } of boxes) {
    for (let k = 0; k < each; k++) {
      const x = rect.left + Math.random() * rect.width;
      grains.push({
        x,
        y: rect.top + rect.height * (0.25 + Math.random() * 0.6),
        // The wind blows from the left: the far edge goes first, as sand does.
        vx: 35 + Math.random() * 85,
        vy: -15 + Math.random() * 35,
        r: 0.6 + Math.random() * 1.1,
        color: Math.random() < 0.45 ? color : palette[(Math.random() * palette.length) | 0],
        delay: (1 - (x - left) / width) * 0.45 + Math.random() * (MAX_DELAY - 0.45),
      });
    }
  }
  return grains;
}

// The fade runs on the compositor (its own layer, a Web Animation). Even so,
// in the app's WebKit a row inside a scrolled rail is not repainted under the
// sand canvas, so crumble only what is on the page, never a rail row.
function hide(els: HTMLElement[], ms = FADE_MS) {
  const was = els.map((el) => [el.style.willChange, el.style.opacity] as const);
  const fades = els.map((el) => {
    el.style.willChange = 'opacity';
    const a = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms, easing: 'ease-out', fill: 'forwards' });
    el.style.opacity = '0';
    return a;
  });
  return () =>
    els.forEach((el, i) => {
      fades[i].cancel();
      el.style.willChange = was[i][0];
      el.style.opacity = was[i][1];
    });
}

/**
 * Crumble `into` (turned to sand) and fade `fade` (gone without grains).
 * Resolves with `end` once most of the sand has blown.
 */
export function crumble(into: HTMLElement[], fade: HTMLElement[] = [], tone: Tone = 'sand'): Promise<() => void> {
  const all = [...into, ...fade];
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const end = hide(all, 420);
    return new Promise((done) => setTimeout(() => done(end), 420));
  }
  const grains = grainsFor(into, tone);
  const end = hide(all);
  if (!grains.length) return new Promise((done) => setTimeout(() => done(end), FADE_MS));

  const canvas = document.createElement('canvas');
  const dpr = devicePixelRatio || 1;
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: '60' });
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);

  // The card is sand first, then the wind takes it: the grains rise in its
  // place as it fades, rest a moment, then blow. The screen moves on (the row
  // closes up) once most of the sand has blown; the rest finishes on its own canvas.
  return new Promise((done) => {
    const start = performance.now();
    setTimeout(() => done(end), (HOLD + CLEAR) * 1000);
    const frame = (t: number) => {
      const s = (t - start) / 1000;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      const rise = Math.min(1, s / (FADE_MS / 1000));
      for (const g of grains) {
        const p = Math.max(0, s - HOLD - g.delay);
        const life = Math.min(1, p / (SECONDS - MAX_DELAY));
        if (life >= 1) continue;
        // Eased: a grain lifts slowly, then the wind takes it.
        const e = p * p * 0.9 + p * 0.1;
        ctx.globalAlpha = rise * (1 - life * life);
        ctx.fillStyle = g.color;
        ctx.beginPath();
        ctx.arc(g.x + g.vx * e, g.y + g.vy * e + 14 * e * e, g.r, 0, Math.PI * 2);
        ctx.fill();
      }
      if (s < HOLD + SECONDS) requestAnimationFrame(frame);
      else canvas.remove();
    };
    requestAnimationFrame(frame);
  });
}
