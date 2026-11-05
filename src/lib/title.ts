// The note's title: its first `# heading`, edited in its own field above the
// note (`Main.svelte`), never in the editor. The editor holds only the body.
// On disk a note stays plain markdown: `# Title`, a blank line, the body.

export interface Split {
  /** Blank lines before the heading, kept as they were. */
  before: string;
  /** The heading's text, or null when the note has none. */
  title: string | null;
  /** What lies between the heading line and the body (its line break and blank lines). */
  gap: string;
  body: string;
}

/** A note split into its title (its first line, if that is a `# heading`) and its body. */
export function splitNote(text: string): Split {
  const m = /^(\s*\n)?# ([^\n]*)(\n\s*\n|\n|$)/.exec(text);
  // The heading must be the first line with text, and a level-one heading.
  if (!m || (m[1] ?? '').trim()) return { before: '', title: null, gap: '', body: text };
  return { before: m[1] ?? '', title: m[2].trim(), gap: m[3], body: text.slice(m[0].length) };
}

/** The note's text with `title` (empty for none) and `body`, kept as close to `was` as it can be. */
export function joinNote(was: Split, title: string | null, body: string): string {
  const t = (title ?? '').replace(/\s*\n\s*/g, ' ').trim();
  if (!t) {
    // A body that starts with its own `# heading` (a woven note's second
    // heading) would read as the title: an empty heading line stays on top.
    if (/^\s*# /.test(body)) return was.title === '' ? `${was.before}# ${was.gap}${body}` : `${was.before}# \n\n${body}`;
    return was.title === null ? body : was.before + body;
  }
  if (was.title !== null && t === was.title) return `${was.before}# ${was.title}${was.gap}${body}`;
  const gap = was.title === null ? (body ? '\n\n' : '\n') : was.gap || (body ? '\n\n' : '');
  return `${was.before}# ${t}${gap}${body}`;
}
