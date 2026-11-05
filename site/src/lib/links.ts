// The docs name files as code spans (`src/app.css`, `visit.rs`). A span that
// names a real file becomes a link: a doc to its page, anything else to GitHub.
// Anything that only looks like a path stays plain code.
import { PAGES } from './docs';
import { withBase } from './base';

const REPO_URL = 'https://github.com/dylanpieper/mandala';

function fileUrl(path: string): string {
  const page = PAGES.find((p) => p.source === path);
  return page ? withBase(`/docs/${page.slug}`) : `${REPO_URL}/blob/main/${path}`;
}

/** The URL a code span or relative link points to, or null to leave it alone. */
export function resolvePath(text: string, files: string[]): string | null {
  const t = text.trim();
  if (!t || /\s|::/.test(t) || !/[./]/.test(t)) return null;
  if (files.includes(t)) return fileUrl(t);
  const folder = t.replace(/\/+$/, '');
  if (folder && files.some((f) => f.startsWith(`${folder}/`))) return `${REPO_URL}/tree/main/${folder}`;
  const ends = files.filter((f) => f.endsWith(`/${t}`));
  return ends.length === 1 ? fileUrl(ends[0]) : null;
}

type MdNode = { type: string; value?: string; url?: string; children?: MdNode[] };

/** A remark plugin: code spans and relative links that name a file become links. */
export function remarkCodeLinks(options: { files: string[] }) {
  const { files } = options;
  return (tree: MdNode) => {
    const walk = (node: MdNode, inLink: boolean) => {
      if (!node.children) return;
      node.children = node.children.map((child) => {
        if (child.type === 'inlineCode' && !inLink) {
          const url = resolvePath(child.value ?? '', files);
          return url ? { type: 'link', url, children: [child] } : child;
        }
        if (child.type === 'link' && child.url && !/^([a-z]+:|#|\/)/i.test(child.url)) {
          const [path, anchor] = child.url.split('#');
          const url = resolvePath(path, files);
          if (url) child.url = anchor ? `${url}#${anchor}` : url;
        }
        walk(child, inLink || child.type === 'link');
        return child;
      });
    };
    walk(tree, false);
  };
}
