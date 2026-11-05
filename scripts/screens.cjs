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

  // The opening walks itself: arrive → what came in → conflict → leaving.
  await go('opening');
  await page.waitForTimeout(1200);
  await shot('opening-1-arrive');
  await page.getByRole('heading', { name: 'What came in' }).waitFor({ timeout: 15000 });
  await shot('opening-2-came-in');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByText('iCloud kept two copies').waitFor();
  await shot('opening-3-conflict');
  await page.getByRole('button', { name: 'Use this one' }).first().click();
  await page.getByRole('heading', { name: 'What’s leaving' }).waitFor();
  await shot('opening-4-leaving');

  await go('main');
  await page.getByText('Morning pages').first().waitFor();
  await shot('main');

  await page.getByRole('button', { name: /Set in stone/ }).click();
  await shot('keep');
  await page.keyboard.press('Escape');

  await page.keyboard.press('Meta+k');
  await page.getByPlaceholder('Search stone and sand').fill('twenty');
  await shot('search');
  await page.keyboard.press('Escape');

  await go('closing');
  await shot('closing');

  await browser.close();
  if (errors.length) {
    console.error('\nErrors in the page:\n' + errors.join('\n'));
    process.exit(1);
  }
})();
