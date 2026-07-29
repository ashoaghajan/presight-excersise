/**
 * Top-20 facet counts.
 *
 * The requirement is explicit that these reflect the *current* result set, not
 * the global dataset — a sidebar showing global counts is the single most
 * common way this feature is got wrong, and it looks entirely correct until you
 * apply a filter.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FACET_LIMIT } from '@presight/shared';

import {
  createTestContext,
  expectedFacets,
  expectedUsers,
  query,
  type TestContext,
} from '../test/fixture';

let ctx: TestContext;

beforeAll(() => {
  ctx = createTestContext();
});

afterAll(() => ctx.close());

/** The filter states the facets must be correct for. */
const FILTER_STATES = () => {
  const nationality = ctx.oracle[0]!.nationality;
  const otherNationality =
    ctx.oracle.find((user) => user.nationality !== nationality)?.nationality ?? nationality;
  const hobby = ctx.oracle.find((user) => user.hobbies.length > 1)!.hobbies[0]!;
  const secondHobby = ctx.oracle.find((user) => user.hobbies.length > 1)!.hobbies[1]!;

  return [
    { label: 'unfiltered', q: {} },
    { label: 'search only', q: { search: 'a' } },
    { label: 'one nationality', q: { nationalities: [nationality] } },
    { label: 'two nationalities', q: { nationalities: [nationality, otherNationality] } },
    { label: 'one hobby', q: { hobbies: [hobby] } },
    { label: 'two hobbies (AND)', q: { hobbies: [hobby, secondHobby] } },
    {
      label: 'all three filters',
      q: { search: 'a', nationalities: [nationality], hobbies: [hobby] },
    },
    { label: 'empty result set', q: { search: 'zzzznothing' } },
  ];
};

describe('facet counts', () => {
  it('match the oracle — value, count and ordering — for every filter state', () => {
    for (const { label, q } of FILTER_STATES()) {
      // Hobby facets apply every active filter.
      expect(ctx.facetRepository.getTopHobbies(query(q), FACET_LIMIT), `${label}: hobbies`).toEqual(
        expectedFacets(expectedUsers(ctx.oracle, q), 'hobbies'),
      );

      // Nationality facets are disjunctive: search and hobbies apply, the
      // nationality selection does not. See the note in facet.repository.ts.
      expect(
        ctx.facetRepository.getTopNationalities(query(q), FACET_LIMIT),
        `${label}: nationalities`,
      ).toEqual(
        expectedFacets(expectedUsers(ctx.oracle, { ...q, nationalities: [] }), 'nationalities'),
      );
    }
  });

  it('caps each list at the facet limit', () => {
    expect(ctx.facetRepository.getTopHobbies(query(), FACET_LIMIT).length).toBeLessThanOrEqual(
      FACET_LIMIT,
    );
    expect(
      ctx.facetRepository.getTopNationalities(query(), FACET_LIMIT).length,
    ).toBeLessThanOrEqual(FACET_LIMIT);
  });

  it('orders by count desc, then value asc', () => {
    // The secondary key matters: without it, equal-count facets could swap
    // places between identical requests and the checkboxes would appear to jump.
    const facets = ctx.facetRepository.getTopHobbies(query(), FACET_LIMIT);
    for (let i = 1; i < facets.length; i++) {
      const prev = facets[i - 1]!;
      const cur = facets[i]!;
      expect(prev.count).toBeGreaterThanOrEqual(cur.count);
      if (prev.count === cur.count) {
        expect(prev.value.toLowerCase() < cur.value.toLowerCase()).toBe(true);
      }
    }
  });

  it('keeps every other nationality selectable after one is chosen', () => {
    // A user holds exactly ONE nationality, so counting nationalities over a
    // nationality-filtered set can only return the selected value — which would
    // collapse the sidebar to a single checkbox and leave the OR filter with no
    // way to take a second value.
    const nationality = ctx.oracle[0]!.nationality;
    const facets = ctx.facetRepository.getTopNationalities(
      query({ nationalities: [nationality] }),
      FACET_LIMIT,
    );

    expect(facets.length).toBeGreaterThan(1);
    expect(facets.map((facet) => facet.value)).toContain(nationality);
    // And the others carry real, non-zero counts — they are selectable options,
    // not disabled leftovers.
    const others = facets.filter((facet) => facet.value !== nationality);
    expect(others.every((facet) => facet.count > 0)).toBe(true);
  });

  it('does not change a nationality count when that nationality is selected', () => {
    // "Japan (57)" must mean the same thing before and after ticking India:
    // selecting Japan too would bring in 57 users.
    const unfiltered = ctx.facetRepository.getTopNationalities(query(), FACET_LIMIT);
    const selected = unfiltered[0]!.value;
    const afterSelecting = ctx.facetRepository.getTopNationalities(
      query({ nationalities: [selected] }),
      FACET_LIMIT,
    );

    expect(afterSelecting).toEqual(unfiltered);
  });

  it('still narrows nationality counts by search and hobbies', () => {
    // Only the nationality dimension is excluded — the other filters must
    // still apply, or the counts would be global.
    const hobby = ctx.facetRepository.getTopHobbies(query(), FACET_LIMIT)[0]!.value;
    const unfiltered = ctx.facetRepository.getTopNationalities(query(), FACET_LIMIT);
    const withHobby = ctx.facetRepository.getTopNationalities(
      query({ hobbies: [hobby] }),
      FACET_LIMIT,
    );

    const total = (facets: typeof unfiltered) => facets.reduce((n, f) => n + f.count, 0);
    expect(total(withHobby)).toBeLessThan(total(unfiltered));
  });

  it('narrows the hobby list when a hobby is selected', () => {
    // The counterpart to the rule above: hobbies are conjunctive, so each added
    // hobby must genuinely narrow the remaining options.
    const hobby = ctx.facetRepository.getTopHobbies(query(), FACET_LIMIT)[0]!.value;
    const after = ctx.facetRepository.getTopHobbies(query({ hobbies: [hobby] }), FACET_LIMIT);
    const siblings = after.filter((facet) => facet.value !== hobby);

    // Still plenty to pick from — a user has many hobbies — but every sibling
    // count is now bounded by the filtered total.
    expect(siblings.length).toBeGreaterThan(0);
    const total = ctx.userRepository.countUsers(query({ hobbies: [hobby] }));
    expect(siblings.every((facet) => facet.count <= total)).toBe(true);
  });

  it('reports a selected hobby at exactly the result total', () => {
    // Every remaining user has it, by definition of the AND filter.
    const hobby = ctx.facetRepository.getTopHobbies(query(), FACET_LIMIT)[0]!.value;
    const q = query({ hobbies: [hobby] });
    const facet = ctx.facetRepository.getTopHobbies(q, FACET_LIMIT).find((f) => f.value === hobby);
    expect(facet?.count).toBe(ctx.userRepository.countUsers(q));
  });

  it('partitions the result set across nationalities', () => {
    // Each user has exactly one nationality, so when the whole facet list fits
    // under the cap the counts must sum to the total — the facets describe the
    // set rather than approximating it.
    const q = query({ search: 'a' });
    const facets = ctx.facetRepository.getTopNationalities(q, FACET_LIMIT);
    if (facets.length < FACET_LIMIT) {
      const sum = facets.reduce((n, facet) => n + facet.count, 0);
      expect(sum).toBe(ctx.userRepository.countUsers(q));
    }
  });

  it('recomputes rather than filtering a global list', () => {
    // Under a nationality filter the hobby ordering should genuinely change,
    // not just lose entries.
    const nationality = ctx.oracle[0]!.nationality;
    const global = ctx.facetRepository.getTopHobbies(query(), FACET_LIMIT);
    const filtered = ctx.facetRepository.getTopHobbies(
      query({ nationalities: [nationality] }),
      FACET_LIMIT,
    );

    const top = global[0]!;
    const sameInFiltered = filtered.find((facet) => facet.value === top.value);
    expect(sameInFiltered === undefined || sameInFiltered.count < top.count).toBe(true);
  });

  it('returns empty lists for an empty result set, not stale ones', () => {
    const q = query({ search: 'zzzznothing' });
    expect(ctx.facetRepository.getTopHobbies(q, FACET_LIMIT)).toEqual([]);
    expect(ctx.facetRepository.getTopNationalities(q, FACET_LIMIT)).toEqual([]);
  });
});
