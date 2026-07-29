import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const OUT = fileURLToPath(new URL('./__screenshots__', import.meta.url));
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE_URL ?? 'http://localhost:5199';
let failures = 0;
const check = (l, ok, d) => { console.log(`  ${ok?'PASS':'FAIL'}  ${l}`, ok?'':JSON.stringify(d??'')); if(!ok) failures++; };
const browser = await chromium.launch({ channel: 'chrome' });

// ---- SKELETON (throttle the API so the loading state is observable) ----
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.route('**/api/users*', async (route) => {
    await new Promise((r) => setTimeout(r, 2500));
    await route.continue();
  });
  await page.goto(BASE);
  await page.waitForTimeout(600);
  console.log('\n=== SKELETON ===');
  const pulses = await page.locator('.animate-pulse').count();
  check('skeleton placeholders shown while loading', pulses > 0, pulses);
  check('sidebar also shows skeletons', await page.locator('aside .animate-pulse').count() > 0);
  check('live region announces loading', (await page.locator('main p').first().textContent()).includes('Loading'));
  await page.screenshot({ path: `${OUT}/skeleton.png` });

  // No layout shift: measure the first card box before and after data lands.
  // Compare ONE skeleton row to ONE card — comparing the whole skeleton
  // container to a single card is not like-for-like.
  const before = await page.locator('main .animate-pulse').first().evaluateHandle(
    (el) => el.closest('div[style]') ?? el.parentElement.parentElement.parentElement,
  ).then((h) => h.asElement().boundingBox());
  await page.waitForSelector('article', { timeout: 15000 });
  await page.waitForTimeout(300);
  const after = await page.locator('article').first().boundingBox();
  check('one skeleton row ≈ one card height (no jump)', Math.abs(before.height - after.height) < 40,
    { skeleton: before.height, card: after.height });
  await ctx.close();
}

// ---- EMPTY ----
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/?search=zzzznothing`);
  await page.waitForSelector('text=No users found', { timeout: 10000 });
  console.log('\n=== EMPTY ===');
  check('empty heading', await page.locator('text=No users found').isVisible());
  check('gives search-appropriate advice (not the hobby AND rule)',
    await page.locator('text=/try a shorter search term/i').isVisible());
  check('offers a way out', await page.getByRole('button', { name: /clear search and filters/i }).isVisible());
  await page.screenshot({ path: `${OUT}/empty.png` });
  await ctx.close();
}

// ---- ERROR ----
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  let failRequests = true;
  await page.route('**/api/users*', (route) =>
    failRequests ? route.abort('failed') : route.continue(),
  );
  await page.goto(`${BASE}/?search=al`);
  await page.waitForSelector('[role=alert]', { timeout: 15000 });
  console.log('\n=== ERROR ===');
  check('error is announced via role=alert', await page.locator('[role=alert]').isVisible());
  check('retry offered', await page.getByRole('button', { name: /try again/i }).isVisible());
  await page.screenshot({ path: `${OUT}/error.png` });

  // Recovery: stop failing, then press Try again.
  failRequests = false;
  await page.getByRole('button', { name: /try again/i }).click();
  let recovered = true;
  try {
    await page.waitForSelector('article', { timeout: 15000 });
  } catch {
    recovered = false;
  }
  check('retry recovers and renders the list', recovered && (await page.locator('article').count()) > 0);
  await ctx.close();
}

// ---- KEYBOARD + FOCUS (desktop) ----
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('article');
  console.log('\n=== KEYBOARD / FOCUS (desktop) ===');

  await page.keyboard.press('Tab');
  const first = await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
  check('Tab reaches the search field first', first === 'user-search', first);

  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  const third = await page.evaluate(() => document.activeElement?.tagName);
  check('Tab continues into the sort controls', ['SELECT','BUTTON'].includes(third), third);

  // Visible focus indicator.
  await page.locator('#user-search').focus();
  const outline = await page.evaluate(() => {
    const s = getComputedStyle(document.activeElement);
    return { w: s.outlineWidth, style: s.outlineStyle };
  });
  check('focus ring is visible on the focused control', outline.style !== 'none' && parseFloat(outline.w) >= 2, outline);

  // Operate a filter entirely by keyboard.
  const box = page.locator('aside input[type=checkbox]').first();
  await box.focus();
  await page.keyboard.press('Space');
  await page.waitForTimeout(1200);
  check('Space toggles a filter and updates the URL', page.url().includes('nationalities='), page.url());
  await page.screenshot({ path: `${OUT}/focus-ring.png` });
  await ctx.close();
}

// ---- REDUCED MOTION ----
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('article');
  console.log('\n=== REDUCED MOTION ===');
  await page.locator('button[aria-haspopup="dialog"]').click();
  await page.waitForSelector('[role=dialog]');
  const anim = await page.evaluate(() => getComputedStyle(document.querySelector('[role=dialog]')).animationName);
  check('drawer slide is suppressed under prefers-reduced-motion', anim === 'none', anim);
  check('drawer still opens and is usable', await page.locator('[role=dialog]').isVisible());
  await ctx.close();
}

await browser.close();
console.log(`\n${'='.repeat(50)}`);
console.log(failures === 0 ? 'STATE + A11Y CHECKS PASSED' : `${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
