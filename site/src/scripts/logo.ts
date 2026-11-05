// The mandala at the top of the home page: sand gathers round the stone
// petals, grain by grain, then is swept; the stone stays. The drawing is the
// logo's (scripts/logo.mjs): a rim with ticks, eight petals, a centre.

const STONE = '#a9bcc6';
const SAND = '#d9ae6c';
const VERMILION = '#d9653f';
const LOOP = 10000;

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const clamp = (t: number) => Math.max(0, Math.min(1, t));

/** Draws the mandala in `canvas`, looping. Returns a stop function. */
export function drawLogo(canvas: HTMLCanvasElement): () => void {
  const size = canvas.clientWidth;
  const dpr = devicePixelRatio || 1;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  const x = canvas.getContext('2d')!;
  x.scale(dpr, dpr);
  const c = size / 2;
  const S = size / 2 / 460;
  let seed = 5;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const grains = Array.from({ length: 260 }, () => ({
    a: rnd() * Math.PI * 2,
    r: (270 + rnd() * 110) * S,
    z: (6 + rnd() * 7) * S,
    d: rnd(),
    v: rnd() < 0.05,
    o: 0.5 + rnd() * 0.4,
  }));
  const petal = (a: number) => {
    x.save();
    x.translate(c, c);
    x.rotate(a);
    x.beginPath();
    x.moveTo(0, -64 * S);
    x.bezierCurveTo(62 * S, -112 * S, 70 * S, -186 * S, 0, -246 * S);
    x.bezierCurveTo(-70 * S, -186 * S, -62 * S, -112 * S, 0, -64 * S);
    x.stroke();
    x.restore();
  };
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let frame = 0;
  const draw = (now: number) => {
    const t = still ? 0.5 : (now % LOOP) / LOOP;
    x.clearRect(0, 0, size, size);
    x.strokeStyle = STONE;
    x.globalAlpha = 0.35;
    x.lineWidth = 6 * S;
    x.beginPath();
    x.arc(c, c, 430 * S, 0, Math.PI * 2);
    x.stroke();
    x.lineWidth = 5 * S;
    for (let k = 0; k < 48; k++) {
      const a = (k * Math.PI) / 24;
      x.beginPath();
      x.moveTo(c + Math.cos(a) * 404 * S, c + Math.sin(a) * 404 * S);
      x.lineTo(c + Math.cos(a) * 430 * S, c + Math.sin(a) * 430 * S);
      x.stroke();
    }
    x.globalAlpha = 1;
    x.lineWidth = 14 * S;
    x.lineJoin = 'round';
    for (let k = 0; k < 8; k++) petal((k * Math.PI) / 4);
    x.fillStyle = STONE;
    x.beginPath();
    x.arc(c, c, 40 * S, 0, Math.PI * 2);
    x.fill();
    for (const g of grains) {
      const shown = ease(clamp((t - g.d * 0.5) / 0.08));
      const swept = ease(clamp((t - 0.66 - g.d * 0.12) / 0.22));
      if (shown <= 0 || swept >= 1) continue;
      const a = g.a + swept * 0.9;
      const r = g.r + swept * 240 * S;
      x.globalAlpha = shown * (1 - swept) * g.o;
      x.fillStyle = g.v ? VERMILION : SAND;
      x.beginPath();
      x.arc(c + Math.cos(a) * r, c + Math.sin(a) * r, g.z, 0, Math.PI * 2);
      x.fill();
    }
    x.globalAlpha = 1;
    if (!still) frame = requestAnimationFrame(draw);
  };
  frame = requestAnimationFrame(draw);
  return () => cancelAnimationFrame(frame);
}
