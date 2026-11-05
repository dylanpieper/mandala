// Draws Mandala's logo from the mandala view: a stone lotus at the centre,
// sand grains drifting outward, the rim with its ticks. Writes:
//   docs/logo.svg               transparent, for the README
//   src-tauri/icons/source.svg  on the app icon's dark tile
// Positions come from a seeded random, so every run draws the same logo.
// Run: node scripts/logo.mjs, then make the PNG and the icon sizes (site/docs/release.md).

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const STONE = '#a9bcc6';
const SAND = '#d9ae6c';
const VERMILION = '#d9653f';
const GROUND = '#141317';

let seed = 11;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const f = (n) => Math.round(n * 10) / 10;

// Sand: grains on the way out, more and smaller toward the rim. One leaves soon.
// `t` is how far out a grain is, 0 at the lotus and 1 at the rim.
const grains = Array.from({ length: 46 }, (_, i) => ({ a: rand() * Math.PI * 2, t: Math.sqrt(rand()), color: i === 7 ? VERMILION : SAND }));

/**
 * The mark. With no `phase` it is the still logo. With a `phase` from 0 to 1
 * it is one moment of the loop: each grain has drifted that much further out
 * (wrapping round, fading in near the lotus and out at the rim), and the lotus
 * has taken two breaths over the loop.
 */
function mark(phase) {
  const moving = phase !== undefined;
  const out = [];
  // The rim and its ticks.
  out.push(`<circle r="430" fill="none" stroke="${STONE}" stroke-opacity="0.35" stroke-width="6"/>`);
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const r1 = i % 4 === 0 ? 404 : 414;
    out.push(`<path d="M${f(Math.cos(a) * r1)} ${f(Math.sin(a) * r1)}L${f(Math.cos(a) * 430)} ${f(Math.sin(a) * 430)}" stroke="${STONE}" stroke-opacity="0.35" stroke-width="5" stroke-linecap="round"/>`);
  }
  for (const g of grains) {
    const t = moving ? (g.t + phase) % 1 : g.t;
    const r = 268 + t * 112;
    const size = 15 - t * 8;
    const edge = moving ? Math.min(1, t / 0.12, (1 - t) / 0.2) : 1;
    out.push(`<circle cx="${f(Math.cos(g.a) * r)}" cy="${f(Math.sin(g.a) * r)}" r="${f(size)}" fill="${g.color}" fill-opacity="${f((1 - t * 0.45) * edge)}"/>`);
  }
  // Stone: an eight-petalled lotus, and a seed at its heart.
  // Each petal's points are turned (and breathed) here, not with `transform`,
  // so every renderer draws the same shape.
  const s = moving ? 1 + 0.035 * Math.sin(phase * Math.PI * 4) : 1;
  const petal = [[0, -64], [62, -112], [70, -186], [0, -246], [-70, -186], [-62, -112], [0, -64]];
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const p = petal.map(([x, y]) => [f((x * Math.cos(a) - y * Math.sin(a)) * s), f((x * Math.sin(a) + y * Math.cos(a)) * s)]);
    const d = `M${p[0].join(' ')}C${p[1].join(' ')} ${p[2].join(' ')} ${p[3].join(' ')}C${p[4].join(' ')} ${p[5].join(' ')} ${p[6].join(' ')}Z`;
    out.push(`<path d="${d}" fill="none" stroke="${STONE}" stroke-width="14" stroke-linejoin="round"/>`);
  }
  out.push(`<circle r="${f(40 * s)}" fill="${STONE}"/>`);
  return out.join('\n  ');
}

/**
 * The mark for the app icon: the same picture with less in it, so it reads
 * at 32 px in a Dock or taskbar. No ticks; one bold rim; a larger lotus drawn
 * in thick strokes; two rings of big grains, in step with the petals and clear
 * of them (one leaving soon); a bigger seed.
 */
function iconMark() {
  const out = [];
  out.push(`<circle r="414" fill="none" stroke="${STONE}" stroke-opacity="0.5" stroke-width="26"/>`);
  // Two rings of sand, in step with the eight petals so no grain touches one:
  // larger grains in the gaps between petals, smaller ones beyond each tip,
  // one of them in vermilion (a note leaving soon).
  for (let i = 0; i < 8; i++) {
    const between = ((i * 45 + 22.5) * Math.PI) / 180;
    out.push(`<circle cx="${f(Math.cos(between) * 312)}" cy="${f(Math.sin(between) * 312)}" r="30" fill="${SAND}"/>`);
    const beyond = (i * 45 * Math.PI) / 180;
    out.push(`<circle cx="${f(Math.cos(beyond) * 352)}" cy="${f(Math.sin(beyond) * 352)}" r="21" fill="${i === 5 ? VERMILION : SAND}"/>`);
  }
  // Petals that start clear of the seed, so the thick strokes never crowd the centre.
  const petal = [[0, -118], [56, -156], [64, -218], [0, -272], [-64, -218], [-56, -156], [0, -118]];
  const s = 1;
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const p = petal.map(([x, y]) => [f((x * Math.cos(a) - y * Math.sin(a)) * s), f((x * Math.sin(a) + y * Math.cos(a)) * s)]);
    const d = `M${p[0].join(' ')}C${p[1].join(' ')} ${p[2].join(' ')} ${p[3].join(' ')}C${p[4].join(' ')} ${p[5].join(' ')} ${p[6].join(' ')}Z`;
    out.push(`<path d="${d}" fill="none" stroke="${STONE}" stroke-width="28" stroke-linejoin="round"/>`);
  }
  out.push(`<circle r="70" fill="${STONE}"/>`);
  return out.join('\n  ');
}

const body = mark();
writeFileSync(
  join(root, 'docs/logo.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-460 -460 920 920" width="240" height="240" role="img" aria-label="Mandala">\n  ${body}\n</svg>\n`,
);
writeFileSync(
  join(root, 'src-tauri/icons/source.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">\n<rect x="64" y="64" width="896" height="896" rx="200" fill="${GROUND}"/>\n<g transform="translate(512 512) scale(0.86)">\n  ${iconMark()}\n</g>\n</svg>\n`,
);
console.log('wrote docs/logo.svg and src-tauri/icons/source.svg');

// `--gif`: the README's moving logo, docs/logo.gif. Frames of the loop on the
// icon's dark tile (a GIF has no soft edges against a page, so the mark keeps
// its own ground), drawn to PNG by `sips` and joined by `ffmpeg`. macOS only.
if (process.argv.includes('--gif')) {
  const SIZE = 320;
  const FPS = 15;
  const SECONDS = 8;
  const frames = FPS * SECONDS;
  const dir = mkdtempSync(join(tmpdir(), 'mandala-logo-'));
  for (let i = 0; i < frames; i++) {
    const n = String(i).padStart(3, '0');
    const svg = join(dir, `f${n}.svg`);
    writeFileSync(
      svg,
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="${SIZE}" height="${SIZE}">\n<rect width="1024" height="1024" fill="${GROUND}"/>\n<g transform="translate(512 512) scale(0.98)">\n  ${mark(i / frames)}\n</g>\n</svg>\n`,
    );
    execFileSync('sips', ['-s', 'format', 'png', svg, '--out', join(dir, `f${n}.png`)], { stdio: 'ignore' });
  }
  const out = join(root, 'docs/logo.gif');
  execFileSync(
    'ffmpeg',
    ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(dir, 'f%03d.png'), '-vf', 'split[a][b];[a]palettegen=max_colors=64[p];[b][p]paletteuse=dither=none', '-loop', '0', out],
    { stdio: 'inherit' },
  );
  rmSync(dir, { recursive: true });
  console.log('wrote docs/logo.gif');
}
