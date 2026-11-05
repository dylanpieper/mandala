// `[[` autocomplete: typing `[[` (or `![[`) offers the vault's note titles.
// Choosing one writes `Title]]`, as Obsidian links by name.
import { autocompletion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import { Facet } from '@codemirror/state';

/** The link being typed at the end of `before` (the line up to the caret), if any. */
export function linkQuery(before: string): { offset: number; query: string } | null {
  const open = before.lastIndexOf('[[');
  if (open === -1) return null;
  const query = before.slice(open + 2);
  if (/[\]|]/.test(query)) return null;
  return { offset: open + 2, query };
}

/** Titles that hold `query`: those starting with it, then a word starting with it, then the rest. */
export function rankTitles(titles: string[], query: string): string[] {
  const q = query.toLowerCase();
  const byName = (a: string, b: string) => a.toLowerCase().localeCompare(b.toLowerCase());
  const tiers: string[][] = [[], [], []];
  for (const t of new Set(titles)) {
    const l = t.toLowerCase();
    if (l.startsWith(q)) tiers[0].push(t);
    else if (l.split(/[\s\-_,.]+/).some((w) => w.startsWith(q))) tiers[1].push(t);
    else if (l.includes(q)) tiers[2].push(t);
  }
  return tiers.flatMap((tier) => tier.sort(byName));
}

/** Where the editor finds the vault's titles, read fresh each time. */
export const noteTitles = Facet.define<() => string[], () => string[]>({
  combine: (all) => all[0] ?? (() => []),
});

const MAX = 50;

function source(ctx: CompletionContext): CompletionResult | null {
  const line = ctx.state.doc.lineAt(ctx.pos);
  const found = linkQuery(line.text.slice(0, ctx.pos - line.from));
  if (!found) return null;
  const from = line.from + found.offset;
  // `]]` already after the caret (typed, or closed by the editor): do not add another.
  const closed = ctx.state.sliceDoc(ctx.pos, ctx.pos + 2) === ']]';
  const titles = rankTitles(ctx.state.facet(noteTitles)(), found.query).slice(0, MAX);
  return {
    from,
    filter: false,
    options: titles.map((t, i) => ({
      label: t,
      boost: -i,
      apply: closed ? t : `${t}]]`,
    })),
  };
}

/** Only this source: markdown's own HTML-tag completion stays off. */
export const wikilinkComplete = autocompletion({ override: [source], icons: false, closeOnBlur: true });
