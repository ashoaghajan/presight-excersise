/**
 * Filter interaction checks.
 *
 * The nationality filter is OR, so it has to be possible to select more than
 * one. That is easy to break: because a user holds exactly one nationality,
 * counting nationalities over a nationality-filtered set returns only the
 * selected value, which would leave no other checkbox to click. The server-side
 * rule is covered in `facet.repository.test.ts`; this asserts the thing the user
 * actually does, which is click two checkboxes.
 *
 * Usage: node e2e/filters.mjs   (BASE_URL overrides the target origin)
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

/** The visible result count, e.g. "312 users". */
async function resultCount() {
  const text = await page
    .getByText(/^[\d,]+ users?$/)
    .first()
    .innerText();
  return Number(text.replace(/[^\d]/g, ''));
}

/**
 * Clicks a facet row by index.
 *
 * The real `<input>` is `sr-only` (so it stays focusable and announceable) and
 * the visible box is a sibling that intercepts pointer events — so Playwright's
 * `.check()` on the input times out. The whole row is a `<label>`, which is
 * what a user actually clicks, so that is what this drives.
 */
async function toggleRow(group, index) {
  await group.locator('label').nth(index).click();
  await page.waitForLoadState('networkidle');
}

/** How many checkboxes in a group are currently checked. */
function checkedCount(group) {
  return group.getByRole('checkbox').evaluateAll((boxes) => boxes.filter((b) => b.checked).length);
}

await page.goto(BASE, { waitUntil: 'networkidle' });

const nationalities = page.getByRole('group', { name: /nationality/i });
const hobbies = page.getByRole('group', { name: /hobb/i });

console.log('=== NATIONALITY — multi-select (OR) ===');

const initialCount = await nationalities.getByRole('checkbox').count();
check('several nationalities offered initially', initialCount > 1, `(${initialCount})`);

const unfilteredTotal = await resultCount();

// Select the first nationality.
await toggleRow(nationalities, 0);

const afterOne = await nationalities.getByRole('checkbox').count();
check('the other nationalities are still listed', afterOne > 1, `(${afterOne} listed)`);

const firstTotal = await resultCount();
check('selecting one narrows the results', firstTotal < unfilteredTotal, `${unfilteredTotal} → ${firstTotal}`);

// Select a second, different nationality.
await toggleRow(nationalities, 1);

const checked = await checkedCount(nationalities);
check('two nationalities are checked at once', checked === 2, `(${checked})`);

const selectedInUrl = new URL(page.url()).searchParams.getAll('nationalities');
check('both appear in the URL', selectedInUrl.length === 2, JSON.stringify(selectedInUrl));

const bothTotal = await resultCount();
// OR semantics: a user has exactly one nationality, so two selections must
// return strictly more than one — an intersection would return fewer.
check('adding a second nationality WIDENS the results', bothTotal > firstTotal, `${firstTotal} → ${bothTotal}`);

await page.screenshot({ path: 'e2e/__screenshots__/multi-nationality.png' });

console.log('\n=== HOBBIES — still narrow (AND) ===');

await page.goto(BASE, { waitUntil: 'networkidle' });
const beforeHobby = await resultCount();

await toggleRow(hobbies, 0);
const oneHobby = await resultCount();
check('selecting one hobby narrows', oneHobby < beforeHobby, `${beforeHobby} → ${oneHobby}`);

const remainingHobbies = await hobbies.getByRole('checkbox').count();
check('other hobbies remain selectable', remainingHobbies > 1, `(${remainingHobbies})`);

await toggleRow(hobbies, 1);
const twoHobbies = await resultCount();
check('adding a second hobby narrows further (AND, not OR)', twoHobbies <= oneHobby, `${oneHobby} → ${twoHobbies}`);

console.log(`\n${'='.repeat(50)}`);
console.log(failed === 0 ? 'FILTER CHECKS PASSED' : `${failed} FILTER CHECK(S) FAILED`);
console.log('='.repeat(50));

await browser.close();
process.exit(failed ? 1 : 0);
