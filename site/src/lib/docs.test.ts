import { describe, expect, it } from 'vitest';
import { PAGES, checkPages, headingsOf, repoFiles } from './docs';

const files = repoFiles();

describe('the docs the site shows', () => {
  it('every page maps to a real file', () => {
    for (const p of PAGES) expect(files).toContain(p.source);
  });

  it('passes for the repository as it is', () => {
    expect(() => checkPages(files, headingsOf)).not.toThrow();
  });

  it('fails on an unmapped heading', () => {
    const more = (s: string) => (s === 'site/docs/product.md' ? [...headingsOf(s), 'Something new'] : headingsOf(s));
    expect(() => checkPages(files, more)).toThrow(/Something new/);
  });

  it('fails on a missing heading', () => {
    const fewer = (s: string) => headingsOf(s).filter((h) => !(s === 'site/docs/product.md' && h === 'The phone'));
    expect(() => checkPages(files, fewer)).toThrow(/The phone/);
  });

  it('fails on an ungrouped doc', () => {
    expect(() => checkPages([...files, 'site/docs/new.md'], headingsOf)).toThrow(/site\/docs\/new\.md/);
  });

  it('ignores docs below the top level', () => {
    expect(() => checkPages([...files, 'site/docs/drafts/x.md'], headingsOf)).not.toThrow();
  });

  it('shows the agents file only as a pointer, never as a page', () => {
    expect(PAGES.map((p) => p.source)).not.toContain('AGENTS.md');
    expect(PAGES.map((p) => p.source)).not.toContain('CLAUDE.md');
    expect(PAGES.find((p) => p.slug === 'working')?.source).toBe('site/docs/working.md');
  });

  it('keeps the approved order and slugs', () => {
    expect(PAGES.map((p) => p.slug)).toEqual([
      'how-it-works',
      'opening-and-closing',
      'keeping-and-letting-go',
      'your-phone',
      'vault',
      'editor',
      'combine',
      'design',
      'working',
      'release',
      'roadmap',
      'changes',
    ]);
  });
});
