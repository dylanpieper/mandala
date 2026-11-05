// The site lives under /mandala on GitHub Pages; every internal link goes
// through here, so a page never points outside it.

export const BASE = '/mandala';

/** A site path under the base. A full URL is returned as it is. */
export function withBase(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  const rest = path.replace(/^\/+/, '');
  return `${BASE}/${rest}`;
}
