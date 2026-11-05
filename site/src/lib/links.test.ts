import { describe, expect, it } from 'vitest';
import { resolvePath } from './links';
import { withBase } from './base';
import { renderMarkdown } from './markdown';

const files = [
  'src/app.css',
  'site/docs/combine.md',
  'site/docs/product.md',
  'crates/mandala-core/src/visit.rs',
  'src/lib/crumble.ts',
  'src-tauri/src/main.rs',
  'crates/x/src/main.rs',
  'README.md',
  'docs/README.md',
];
const blob = (p: string) => `https://github.com/dylanpieper/mandala/blob/main/${p}`;

describe('resolvePath', () => {
  it('links a file from the root to GitHub', () => {
    expect(resolvePath('src/app.css', files)).toBe(blob('src/app.css'));
  });
  it('links a doc to its page', () => {
    expect(resolvePath('site/docs/combine.md', files)).toBe(withBase('/docs/combine'));
  });
  it('links product.md to How it works', () => {
    expect(resolvePath('site/docs/product.md', files)).toBe(withBase('/docs/how-it-works'));
  });
  it('links a bare name when one file ends with it', () => {
    expect(resolvePath('visit.rs', files)).toBe(blob('crates/mandala-core/src/visit.rs'));
    expect(resolvePath('lib/crumble.ts', files)).toBe(blob('src/lib/crumble.ts'));
  });
  it('links a folder to its tree', () => {
    expect(resolvePath('src/lib/', files)).toBe('https://github.com/dylanpieper/mandala/tree/main/src/lib');
  });
  it('ambiguous bare name stays code', () => {
    expect(resolvePath('main.rs', files)).toBeNull();
  });
  it('an exact path wins over a bare match', () => {
    expect(resolvePath('README.md', files)).toBe(blob('README.md'));
  });
  it('leaves what is not a path alone', () => {
    for (const t of ['sand/sun/', 'fsx::unique_path', '⌘K', '.md', 'Name 2.md', 'npm run dev']) {
      expect(resolvePath(t, files), t).toBeNull();
    }
  });
});

describe('the plugin in the pipeline', () => {
  it('links a code span in prose', async () => {
    const html = await renderMarkdown('See `src/app.css` for the tokens.', files);
    expect(html).toContain(`<a href="${blob('src/app.css')}"><code>src/app.css</code></a>`);
  });
  it('leaves fences alone', async () => {
    const html = await renderMarkdown('```\nsrc/app.css\n```', files);
    expect(html).not.toContain('<a');
  });
  it('sends a relative markdown link to the doc page', async () => {
    const html = await renderMarkdown('[combining](site/docs/combine.md)', files);
    expect(html).toContain(`href="${withBase('/docs/combine')}"`);
  });
  it('leaves an outside link as it is', async () => {
    const html = await renderMarkdown('[site](https://semver.org)', files);
    expect(html).toContain('href="https://semver.org"');
  });
});
