// Screenshots of every screen, from the browser mock, into ./shots.
// Start `npm run dev` first, then: `node scripts/screens.cjs [width] [height]`.
// The /design and /look commands use this; look at the pictures before
// saying a change is done.

const { chromium } = require('playwright');
const fs = require('fs');

const BASE = process.env.MANDALA_URL || 'http://localhost:1420';
const W = Number(process.argv[2] || 1440);
const H = Number(process.argv[3] || 900);
const OUT = 'shots';

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const shot = async (name) => {
    await page.waitForTimeout(700); // let motion finish
    await page.screenshot({ path: `${OUT}/${name}-${W}.png` });
    console.log(`${OUT}/${name}-${W}.png`);
  };
  const go = async (screen) => {
    await page.goto(`${BASE}/?screen=${screen}`);
    await page.waitForLoadState('networkidle');
  };

  await go('choose');
  await shot('choose');

  await go('arrange');
  await shot('arrange');

  // The opening: the glyph while sync catches up (the mock has two notes to
  // bring down), then the notes, with what left while Mandala was closed.
  await go('opening');
  await shot('opening-syncing');
  await page.getByText(/left while you were away/).waitFor({ timeout: 15000 });
  await shot('opening-left');

  await go('main');
  await page.getByText('Morning pages').first().waitFor();
  await shot('main');

  await page.keyboard.press('Meta+Enter');
  await shot('keep');
  await page.keyboard.press('Escape');

  await page.keyboard.press('Meta+p');
  await page.getByPlaceholder('Search', { exact: true }).fill('twenty');
  await shot('search');
  await page.keyboard.press('Escape');

  await browser.close();
  if (errors.length) {
    console.error('\nErrors in the page:\n' + errors.join('\n'));
    process.exit(1);
  }
})();
