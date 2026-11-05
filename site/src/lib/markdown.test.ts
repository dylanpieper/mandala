import { describe, expect, it } from 'vitest';
import { PAGES, repoFiles } from './docs';
import { keepAllPreamble, ledeOf, renderMarkdown, renderPage } from './markdown';

const files = repoFiles();
const page = (slug: string) => PAGES.find((p) => p.slug === slug)!;

describe('rendering a doc', () => {
  it('how-it-works shows only its sections', async () => {
    const { html } = await renderPage(page('how-it-works'), files);
    expect(html).toContain('>Words</h2>');
    expect(html).toContain('>Lifespans</h2>');
    expect(html).not.toContain('>The phone</h2>');
  });

  it("lede is product.md's first paragraph for how-it-works", async () => {
    const { lede, html } = await renderPage(page('how-it-works'), files);
    expect(lede).toMatch(/^Mandala is a minimalist markdown notes app/);
    expect(html).not.toContain('Mandala is a minimalist markdown notes app');
  });

  it('has no lede for other pages', async () => {
    expect((await renderPage(page('vault'), files)).lede).toBeNull();
  });

  it('drops the # title', async () => {
    const { html } = await renderPage(page('vault'), files);
    expect(html).not.toContain('<h1');
  });

  it('headings carry ids', async () => {
    const { headings } = await renderPage(page('vault'), files);
    expect(headings).toContainEqual({ depth: 2, text: 'Traps', id: 'traps' });
  });

  it('keeps the last three words of a paragraph together', async () => {
    const html = await renderMarkdown('A line that is long enough to wrap, and then it does not already have.', []);
    expect(html).toContain('not already have.');
    expect(html).toContain('it does');
  });

  it('does not join words that are long together', async () => {
    const html = await renderMarkdown('See the function pending_downloads_for_everything request_downloads_everywhere now.', []);
    expect(html).not.toContain(' ');
  });

  it('keeps short words of a list item together', async () => {
    const html = await renderMarkdown('- Cancel or Esc changes nothing at all.', []);
    expect(html).toContain('nothing at all.');
  });

  it('splits the lede from the rest of the preamble', () => {
    expect(ledeOf('\nOne paragraph.\n\nAnother one.\n')).toEqual({ lede: 'One paragraph.', rest: 'Another one.' });
    expect(ledeOf('\nOnly this.\n')).toEqual({ lede: 'Only this.', rest: '' });
  });

  it('fails rather than drop preamble text no page shows', () => {
    expect(() => keepAllPreamble('site/docs/product.md', 'Another one.')).toThrow(/site\/docs\/product\.md.*Another one/);
    expect(() => keepAllPreamble('site/docs/product.md', '')).not.toThrow();
  });

  it('tables render', async () => {
    expect((await renderPage(page('design'), files)).html).toContain('<table>');
  });
});
