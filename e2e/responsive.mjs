import { chromium } from 'playwright';

import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const OUT = fileURLToPath(new URL('./__screenshots__', import.meta.url));
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE_URL ?? 'http://localhost:5199';

let failures = 0;
const check = (l, ok, d) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${l}`, ok ? '' : JSON.stringify(d ?? '')); if (!ok) failures++; };

const browser = await chromium.launch({ channel: 'chrome' });

// ---------------------------------------------------------------- DESKTOP --
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('article', { timeout: 10000 });

  console.log('\n=== DESKTOP 1440x900 ===');
  const aside = page.locator('aside');
  check('sidebar visible', await aside.isVisible());
  check('sidebar is 280px wide', (await aside.boundingBox()).width === 280, (await aside.boundingBox()).width);
  check('mobile Filters trigger hidden', !(await page.locator('button[aria-haspopup="dialog"]').isVisible()));
  check('search visible in header', await page.locator('#user-search').isVisible());
  check('sort controls visible', await page.locator('header select').isVisible());
  check('cards rendered', (await page.locator('article').count()) > 5);

  // Sidebar must sit directly under the sticky header, no gap/overlap.
  const header = await page.locator('header').boundingBox();
  const asideBox = await aside.boundingBox();
  check('sidebar starts at header bottom', Math.abs(asideBox.y - (header.y + header.height)) < 2,
    { asideY: asideBox.y, headerBottom: header.y + header.height });

  await page.screenshot({ path: `${OUT}/desktop.png`, fullPage: false });
  await ctx.close();
}

// ----------------------------------------------------------------- MOBILE --
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },   // iPhone 14
    deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('article', { timeout: 10000 });

  console.log('\n=== MOBILE 390x844 ===');
  check('sidebar hidden', !(await page.locator('aside').isVisible()));
  check('search still visible', await page.locator('#user-search').isVisible());
  check('Filters trigger visible', await page.locator('button[aria-haspopup="dialog"]').isVisible());
  check('sort controls visible', await page.locator('header select').isVisible());

  // No horizontal overflow.
  const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
  check('no horizontal scroll', scrollW <= 390, { scrollW });

  // Cards must stay readable, not squeezed.
  const card = await page.locator('article').first().boundingBox();
  check('card fills the width comfortably', card.width > 330 && card.width <= 374, card.width);

  await page.screenshot({ path: `${OUT}/mobile-list.png` });

  // ---- drawer ----
  console.log('\n  -- filter drawer --');
  await page.locator('button[aria-haspopup="dialog"]').click();
  await page.waitForSelector('[role=dialog]', { state: 'visible' });
  await page.waitForTimeout(350); // let the slide finish

  const dialog = page.locator('[role=dialog]');
  check('drawer opens', await dialog.isVisible());
  check('drawer is modal', (await dialog.getAttribute('aria-modal')) === 'true');
  check('drawer is named', !!(await dialog.getAttribute('aria-labelledby')));
  check('focus moved into drawer', await page.evaluate(() =>
    document.querySelector('[role=dialog]').contains(document.activeElement)));
  check('background scroll locked', await page.evaluate(() => document.body.style.overflow === 'hidden'));

  const box = await dialog.boundingBox();
  check('drawer does not cover the whole screen', box.width < 390, box.width);
  check('drawer is tall enough to be usable', box.height > 700, box.height);

  await page.screenshot({ path: `${OUT}/mobile-drawer.png` });

  // Filter from inside the drawer.
  // Click the LABEL, not the visually-hidden input — that is what a real user
  // (and a screen-reader user pressing Space) actually activates.
  const firstRow = page.locator('[role=dialog] fieldset label').first();
  const name = await firstRow.evaluate((el) => el.querySelector('span.sr-only').textContent);
  await firstRow.click();
  await page.waitForTimeout(1200);
  check('filtering from the drawer updates the URL', page.url().includes('nationalities='), page.url());
  console.log(`     (toggled: ${name})`);

  // Escape closes and focus returns.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  check('Escape closes the drawer', !(await page.locator('[role=dialog]').isVisible()));
  check('scroll unlocked after close', await page.evaluate(() => document.body.style.overflow !== 'hidden'));
  check('focus returned to the trigger', await page.evaluate(() =>
    document.activeElement?.getAttribute('aria-haspopup') === 'dialog'));

  await page.screenshot({ path: `${OUT}/mobile-filtered.png` });
  await ctx.close();
}

// ------------------------------------------------------------ TABLET/EDGE --
{
  for (const [w, h, label] of [[768, 1024, 'tablet-768'], [1024, 768, 'breakpoint-1024'], [320, 700, 'narrow-320']]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForSelector('article', { timeout: 10000 });
    const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
    const sidebar = await page.locator('aside').isVisible();
    console.log(`\n=== ${label} (${w}px) ===`);
    check(`${label}: no horizontal scroll`, scrollW <= w, { scrollW, w });
    check(`${label}: sidebar ${w >= 1024 ? 'visible' : 'hidden'}`, sidebar === (w >= 1024));
    await page.screenshot({ path: `${OUT}/${label}.png` });
    await ctx.close();
  }
}

await browser.close();
console.log(`\n${'='.repeat(50)}`);
console.log(failures === 0 ? 'RESPONSIVE CHECKS PASSED' : `${failures} FAILURE(S)`);
console.log('='.repeat(50));
process.exit(failures === 0 ? 0 : 1);
