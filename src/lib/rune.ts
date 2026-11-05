// A rune for a note: a stave and a few straight cuts on a small grid, chosen
// from a text (why the note is kept, or its name). The same text always gives
// the same rune, so the rune carved when a note is set in stone is the one
// shown beside it later. Drawn in a 24-unit box centred on 0.

const XS = [-6, 0, 6];
const YS = [-9, -3, 3, 9];

type Point = [number, number];

/** Every cut a rune may use: between neighbouring grid points, not along the stave. */
const CUTS: [Point, Point][] = (() => {
  const out: [Point, Point][] = [];
  for (let xi = 0; xi < 3; xi++) {
    for (let yi = 0; yi < 4; yi++) {
      for (const [dx, dy] of [[1, 0], [1, 1], [1, -1], [0, 1]]) {
        const xj = xi + dx;
        const yj = yi + dy;
        if (xj > 2 || yj < 0 || yj > 3) continue;
        // The stave (x = 0, top to bottom) is always there.
        if (xi === 1 && xj === 1) continue;
        out.push([[XS[xi], YS[yi]], [XS[xj], YS[yj]]]);
      }
    }
  }
  return out;
})();

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const key = (p: Point) => `${p[0]},${p[1]}`;

/**
 * The rune's strokes, in carving order, as SVG path data: the stave first,
 * then three to five cuts, each touching what is already cut, so the rune is
 * one connected mark.
 */
export function runeOf(text: string): string[] {
  let s = hash(text.trim().toLowerCase()) || 1;
  const rand = () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909)) >>> 0) / 4294967296;
  const touched = new Set(YS.map((y) => key([0, y])));
  const chosen: [Point, Point][] = [];
  const count = 3 + Math.floor(rand() * 3);
  for (let tries = 0; chosen.length < count && tries < 200; tries++) {
    const c = CUTS[Math.floor(rand() * CUTS.length)];
    if (chosen.includes(c)) continue;
    if (!touched.has(key(c[0])) && !touched.has(key(c[1]))) continue;
    chosen.push(c);
    touched.add(key(c[0]));
    touched.add(key(c[1]));
  }
  return ['M0 -9V9', ...chosen.map(([a, b]) => `M${a[0]} ${a[1]}L${b[0]} ${b[1]}`)];
}

/** The text a note's rune comes from: why it is kept, or else its name. */
export function runeText(because: string, rel: string): string {
  const name = (rel.split('/').pop() ?? rel).replace(/\.md$/i, '').replace(/ \(\d+\)$/, '');
  return because.trim() || name;
}
