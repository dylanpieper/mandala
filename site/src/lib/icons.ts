// The app's icons, read from src/components/Icon.svelte at build time, so the
// site draws exactly what the app draws and never keeps its own copy.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SOURCE = resolve(process.cwd(), '..', 'src/components/Icon.svelte');

let cache: Map<string, string> | null = null;

function load(): Map<string, string> {
  if (cache) return cache;
  const text = readFileSync(SOURCE, 'utf8');
  const blocks = new Map<string, string>();
  const re = /\{(?:#if|:else if) name === '([\w-]+)'\}([\s\S]*?)(?=\{:else|\{\/if\})/g;
  for (const m of text.matchAll(re)) {
    // A nested `{#if on}` (the pane icons) is drawn as on: both rails show.
    blocks.set(m[1], m[2].replace(/<!--[\s\S]*?-->/g, '').replace(/\{[#/:][^}]*\}/g, '').trim());
  }
  cache = blocks;
  return blocks;
}

/** The inner SVG of an app icon, drawn at 16 units with a stroke. */
export function icon(name: string): string {
  const inner = load().get(name);
  if (inner === undefined) throw new Error(`No icon named "${name}" in src/components/Icon.svelte`);
  return inner;
}

export function iconNames(): string[] {
  return [...load().keys()];
}
