// One doc to one page: read it from the repository, keep the sections the page
// shows, and render it with one unified pipeline (Astro 7 renders .md with its
// own engine, so the site does its own).
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeSlug from 'rehype-slug';
import rehypeStringify from 'rehype-stringify';
import { readSource, type Page } from './docs';
import { remarkCodeLinks } from './links';
import { rehypeNoWidows } from './widows';

export interface Heading {
  depth: 2 | 3;
  text: string;
  id: string;
}

export interface Rendered {
  html: string;
  /** The page's opening paragraph, as HTML (only "How it works" has one). */
  lede: string | null;
  headings: Heading[];
}

interface Split {
  preamble: string;
  sections: { heading: string; text: string }[];
}

/** The doc without its `#` title, cut at each `##` (outside fenced code). */
export function split(markdown: string): Split {
  const lines = markdown.split('\n');
  const out: Split = { preamble: '', sections: [] };
  let fenced = false;
  let current: string[] = [];
  let heading: string | null = null;
  const flush = () => {
    const text = current.join('\n');
    if (heading === null) out.preamble = text;
    else out.sections.push({ heading, text });
  };
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    if (!fenced && /^# /.test(line) && heading === null && !out.preamble && !current.some((l) => l.trim())) continue;
    if (!fenced && line.startsWith('## ')) {
      flush();
      heading = line.slice(3).trim();
      current = [line];
    } else current.push(line);
  }
  flush();
  return out;
}

type Node = { type: string; tagName?: string; value?: string; properties?: Record<string, unknown>; children?: Node[] };

const textOf = (n: Node): string => (n.type === 'text' ? (n.value ?? '') : (n.children ?? []).map(textOf).join(''));

function collectHeadings(into: Heading[]) {
  return () => (tree: Node) => {
    const walk = (n: Node) => {
      if (n.type === 'element' && (n.tagName === 'h2' || n.tagName === 'h3')) {
        into.push({ depth: n.tagName === 'h2' ? 2 : 3, text: textOf(n).trim(), id: String(n.properties?.id ?? '') });
      }
      n.children?.forEach(walk);
    };
    walk(tree);
  };
}

async function toHtml(markdown: string, files: string[], headings: Heading[]): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkCodeLinks, { files })
    .use(remarkRehype)
    .use(rehypeSlug)
    .use(collectHeadings(headings))
    .use(rehypeNoWidows)
    .use(rehypeStringify)
    .process(markdown);
  return String(file);
}

/** Markdown to HTML with the site's pipeline (code-span links included). */
export function renderMarkdown(markdown: string, files: string[]): Promise<string> {
  return toHtml(markdown, files, []);
}

/** The first paragraph of a preamble, and whatever follows it. */
export function ledeOf(preamble: string): { lede: string; rest: string } {
  const [lede = '', ...rest] = preamble.trim().split(/\n\s*\n/);
  return { lede: lede.trim(), rest: rest.join('\n\n').trim() };
}

/** A doc split into pages shows only its lede above the first `##`: anything more would be lost. */
export function keepAllPreamble(source: string, rest: string): void {
  if (rest) throw new Error(`${source} has text above its first ## that no page shows: "${rest.slice(0, 60)}". Move it under a heading.`);
}

export async function renderPage(page: Page, files: string[]): Promise<Rendered> {
  const { preamble, sections } = split(readSource(page.source));
  const kept = page.sections ? sections.filter((s) => page.sections!.includes(s.heading)) : sections;
  let lede: string | null = null;
  let intro = page.sections ? '' : preamble;
  if (page.sections) {
    const parts = ledeOf(preamble);
    keepAllPreamble(page.source, parts.rest);
    if (page.slug === 'how-it-works') lede = (await toHtml(parts.lede, files, [])).trim().replace(/^<p>|<\/p>$/g, '');
    intro = '';
  }
  const headings: Heading[] = [];
  const html = await toHtml([intro, ...kept.map((s) => s.text)].join('\n\n'), files, headings);
  return { html, lede, headings };
}
