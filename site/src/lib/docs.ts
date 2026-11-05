// Which docs the site shows, in what order and group, and the check that
// nothing in the repository's docs is left out or lost.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** The repository root: the site is built from `site/`. */
export const REPO = resolve(process.cwd(), '..');

export type Group = 'Using Mandala' | 'How it is built' | 'Working on it';

export interface Page {
  slug: string;
  title: string;
  group: Group;
  /** The file, from the repository root. */
  source: string;
  /** The `##` headings shown, or null for the whole file. */
  sections: string[] | null;
}

const PRODUCT = 'site/docs/product.md';

export const PAGES: Page[] = [
  { slug: 'how-it-works', title: 'How it works', group: 'Using Mandala', source: PRODUCT, sections: ['In short', 'Words', 'Lifespans', 'File names', 'First open', 'Not in Mandala'] },
  { slug: 'opening-and-closing', title: 'Opening and closing', group: 'Using Mandala', source: PRODUCT, sections: ['Opening and closing'] },
  { slug: 'keeping-and-letting-go', title: 'Keeping and letting go', group: 'Using Mandala', source: PRODUCT, sections: ['Keeping', 'Letting go and restoring'] },
  { slug: 'your-phone', title: 'Your phone', group: 'Using Mandala', source: PRODUCT, sections: ['The phone'] },
  { slug: 'vault', title: 'The vault on disk', group: 'How it is built', source: 'site/docs/vault.md', sections: null },
  { slug: 'editor', title: 'The editor', group: 'How it is built', source: 'site/docs/editor.md', sections: null },
  { slug: 'combine', title: 'Combining notes', group: 'How it is built', source: 'site/docs/combine.md', sections: null },
  { slug: 'design', title: 'Design', group: 'How it is built', source: 'site/docs/design.md', sections: null },
  { slug: 'working', title: 'Working on Mandala', group: 'Working on it', source: 'site/docs/working.md', sections: null },
  { slug: 'release', title: 'Releasing', group: 'Working on it', source: 'site/docs/release.md', sections: null },
  { slug: 'roadmap', title: "What's next", group: 'Working on it', source: 'site/docs/roadmap.md', sections: null },
  { slug: 'changes', title: 'Changes', group: 'Working on it', source: 'CHANGELOG.md', sections: null },
];

export const GROUPS: Group[] = ['Using Mandala', 'How it is built', 'Working on it'];

/** Every file in the repository that git does not ignore, committed or not. */
export function repoFiles(): string[] {
  const out = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: REPO, encoding: 'utf8' });
  return out.split('\n').filter(Boolean);
}

export function readSource(source: string): string {
  return readFileSync(resolve(REPO, source), 'utf8');
}

/** The `##` headings of a doc, outside fenced code. */
export function headingsOf(source: string): string[] {
  let fenced = false;
  const out: string[] = [];
  for (const line of readSource(source).split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    else if (!fenced && line.startsWith('## ')) out.push(line.slice(3).trim());
  }
  return out;
}

/** The files that must each be a page: site/docs/*.md and CHANGELOG.md. */
function shown(files: string[]): string[] {
  return files.filter((f) => /^site\/docs\/[^/]+\.md$/.test(f) || f === 'CHANGELOG.md');
}

/** Throws, naming the file or heading, if any doc would be left out or lost. */
export function checkPages(files: string[], headings: (source: string) => string[]): void {
  for (const p of PAGES) {
    if (!files.includes(p.source)) throw new Error(`The site shows ${p.source}, which is not in the repository.`);
  }
  const sources = new Set(PAGES.map((p) => p.source));
  for (const f of shown(files)) {
    if (!sources.has(f)) throw new Error(`${f} has no page: add it to PAGES in site/src/lib/docs.ts.`);
  }
  for (const source of sources) {
    const mapped = PAGES.filter((p) => p.source === source && p.sections).flatMap((p) => p.sections!);
    if (!mapped.length) continue;
    const real = headings(source);
    for (const h of mapped) {
      if (!real.includes(h)) throw new Error(`${source} has no heading "## ${h}", but a page shows it.`);
    }
    for (const h of real) {
      if (!mapped.includes(h)) throw new Error(`${source} has a heading "## ${h}" that no page shows.`);
    }
  }
}
