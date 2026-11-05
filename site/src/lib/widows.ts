// No line ends with a lone word or two (the owner's rule). Chrome's
// `text-wrap: pretty` still leaves one, so the last three words of each block
// are joined with no-break spaces at build time, when they are short together.

const BLOCKS = new Set(['p', 'li', 'td', 'th', 'figcaption']);
const MAX = 24;

type El = { type: string; tagName?: string; value?: string; children?: El[] };

/** The last text node of a block, outside code and nested lists. */
function lastText(node: El): El | null {
  const kids = node.children ?? [];
  for (let i = kids.length - 1; i >= 0; i--) {
    const k = kids[i];
    if (k.type === 'text' && k.value?.trim()) return k;
    if (k.type === 'element' && !['code', 'pre', 'ul', 'ol', 'table'].includes(k.tagName ?? '')) {
      const found = lastText(k);
      if (found) return found;
    }
    if (k.type === 'element' && ['ul', 'ol'].includes(k.tagName ?? '')) continue;
    if (k.type === 'element') return null;
  }
  return null;
}

/** Join the last three words of a text with no-break spaces, if short enough. */
export function joinTail(text: string): string {
  const m = text.match(/^([\s\S]*?)(\S+) (\S+) (\S+)(\s*)$/);
  if (m && m[2].length + m[3].length + m[4].length + 2 <= MAX) return `${m[1]}${m[2]} ${m[3]} ${m[4]}${m[5]}`;
  const two = text.match(/^([\s\S]*?)(\S+) (\S+)(\s*)$/);
  if (two && two[2].length + two[3].length + 1 <= MAX) return `${two[1]}${two[2]} ${two[3]}${two[4]}`;
  return text;
}

export function rehypeNoWidows() {
  return (tree: El) => {
    const walk = (n: El) => {
      if (n.type === 'element' && BLOCKS.has(n.tagName ?? '')) {
        const t = lastText(n);
        if (t?.value) t.value = joinTail(t.value);
      }
      n.children?.forEach(walk);
    };
    walk(tree);
  };
}
