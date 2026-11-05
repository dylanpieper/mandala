// Screenshots of every page at four widths into site/shots/, from a running
// `npm run preview`. Look at them before saying a change is done.
//   node scripts/screens.mjs [path ...]     default: every page
// Uses the installed Chrome (CHROME=/path to choose another). Fails if a page
// makes a request outside localhost.
import { chromium } from 'playwright-core';
import { mkdirSync, readdirSync } from 'node:fs';

const BASE = process.env.SITE_URL || 'http://localhost:4321/mandala';
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const WIDTHS = [1440, 820, 390, 340];
const docs = readdirSync('dist/docs', { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => `/docs/${d.name}`);
const paths = process.argv.slice(2).length ? process.argv.slice(2) : ['/', ...docs];

mkdirSync('shots', { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME });
const outside = [];
for (const width of WIDTHS) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.hostname !== 'localhost' && u.protocol !== 'data:') outside.push(r.url());
  });
  for (const path of paths) {
    await page.goto(BASE + path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const name = (path === '/' ? 'home' : path.replace(/^\/docs\//, 'docs-')).replace(/\//g, '-');
    await page.screenshot({ path: `shots/${name}-${width}.png`, fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (overflow > 0) console.log(`overflow ${overflow}px: ${path} at ${width}`);
  }
  await page.close();
}
await browser.close();
if (outside.length) {
  console.error('Requests outside localhost:\n' + [...new Set(outside)].join('\n'));
  process.exit(1);
}
console.log(`shots/: ${paths.length} pages x ${WIDTHS.length} widths`);
