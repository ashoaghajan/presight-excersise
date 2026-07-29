/**
 * URL-synced state.
 *
 * The brief requires the text filter, selected hobbies, selected nationalities,
 * sort field and sort direction to live in the query string, and reloading or
 * sharing the URL to restore the same view. This drives the real browser:
 * deep-link in cold, assert every control reflects the URL, then reload and
 * assert nothing moved.
 *
 * Usage: node e2e/url-state.mjs   (BASE_URL overrides the target origin)
 */

import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://localhost:5199';

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

let failed = 0;
function check(name, condition, detail = '') {
  console.log(`  ${condition ? 'PASS' : 'FAIL'}  ${name} ${detail}`);
  if (!condition) failed++;
}

/** Reads the full view state back out of the rendered UI. */
async function readUi() {
  const nationalities = page.getByRole('group', { name: /nationality/i });
  const hobbies = page.getByRole('group', { name: /hobb/i });
  const checkedIn = (group) =>
    group.getByRole('checkbox').evaluateAll((boxes) =>
      boxes
        .filter((box) => box.checked)
        // The accessible name is a visually-hidden "Value, N users" phrase.
        .map((box) => box.closest('label')?.textContent?.trim() ?? ''),
    );

  return {
    search: await page.getByRole('searchbox').inputValue(),
    nationalities: await checkedIn(nationalities),
    hobbies: await checkedIn(hobbies),
    sortField: await page.getByRole('combobox').first().inputValue(),
    total: await page
      .getByText(/^[\d,]+ users?$/)
      .first()
      .innerText(),
  };
}

// Every piece of state the brief names, in one link.
const DEEP_LINK =
  '/?search=a&nationalities=India&nationalities=Pakistan&hobbies=Reading&sortField=age&sortDirection=desc';

console.log('=== DEEP LINK (cold load) ===');
await page.goto(BASE + DEEP_LINK, { waitUntil: 'networkidle' });

const restored = await readUi();
check('search text restored', restored.search === 'a', `("${restored.search}")`);
check('both nationalities restored', restored.nationalities.length === 2, JSON.stringify(restored.nationalities));
check('hobby restored', restored.hobbies.length === 1, JSON.stringify(restored.hobbies));
check('sort field restored', restored.sortField === 'age', `(${restored.sortField})`);

// Descending by age: the first card's age must be >= the second's.
// Read the visible "Age: 34" span specifically — the card also carries a
// visually-hidden "34 years old" for screen readers, and `textContent` would
// concatenate the two.
const ages = await page
  .locator('article [aria-hidden="true"]')
  .evaluateAll((nodes) =>
    nodes
      .map((n) => (n.textContent ?? '').match(/^Age:\s*(\d+)$/)?.[1])
      .filter(Boolean)
      .slice(0, 5)
      .map(Number),
  );
check('sort direction applied (age desc)', ages.every((a, i) => i === 0 || ages[i - 1] >= a), JSON.stringify(ages));

console.log('\n=== RELOAD (same URL) ===');
await page.reload({ waitUntil: 'networkidle' });
const afterReload = await readUi();
check('state survives a reload', JSON.stringify(afterReload) === JSON.stringify(restored));
check('result count identical', afterReload.total === restored.total, `${restored.total} → ${afterReload.total}`);

console.log('\n=== BACK / FORWARD ===');
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
const unfiltered = await readUi();
await page.getByRole('group', { name: /nationality/i }).locator('label').first().click();
await page.waitForLoadState('networkidle');
const filtered = await readUi();
check('filtering changed the result count', filtered.total !== unfiltered.total, `${unfiltered.total} → ${filtered.total}`);

await page.goBack({ waitUntil: 'networkidle' });
const back = await readUi();
check('Back restores the previous state', back.total === unfiltered.total, `${filtered.total} → ${back.total}`);
check('Back clears the checkbox', back.nationalities.length === 0);

await page.goForward({ waitUntil: 'networkidle' });
const forward = await readUi();
check('Forward re-applies it', forward.total === filtered.total, `→ ${forward.total}`);

console.log(`\n${'='.repeat(50)}`);
console.log(failed === 0 ? 'URL STATE CHECKS PASSED' : `${failed} URL STATE CHECK(S) FAILED`);
console.log('='.repeat(50));

await browser.close();
process.exit(failed ? 1 : 0);
