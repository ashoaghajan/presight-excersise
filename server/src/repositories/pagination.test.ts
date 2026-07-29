/**
 * Sorting, the `id` tie-breaker, and pagination stability.
 *
 * The requirement these protect is "no duplicates, no skipped records while
 * scrolling". The way that breaks in practice is subtle: rows with equal sort
 * values are free to come back in any order, so two consecutive pages can
 * overlap. Set equality would not catch it — these walks compare the
 * concatenated page sequence to the oracle's fully-sorted id list **element for
 * element**.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SORT_DIRECTIONS, SORT_FIELDS } from '@presight/shared';

import {
  createTestContext,
  expectedOrder,
  expectedUsers,
  query,
  type TestContext,
} from '../test/fixture';

let ctx: TestContext;

beforeAll(() => {
  ctx = createTestContext();
});

afterAll(() => ctx.close());

/** Walks every page for a query and returns the ids in the order received. */
function walk(overrides: Parameters<typeof query>[0], limit: number): number[] {
  const ids: number[] = [];
  const total = ctx.userRepository.countUsers(query({ ...overrides, limit }));

  for (let page = 1; ; page++) {
    const rows = ctx.userRepository.searchUsers(query({ ...overrides, limit, page }));
    if (rows.length === 0) break;
    ids.push(...rows.map((row) => row.id));
    if (ids.length >= total) break;
  }

  return ids;
}

describe('sorting', () => {
  it('orders by every field in both directions, exactly as the oracle does', () => {
    for (const sortField of SORT_FIELDS) {
      for (const sortDirection of SORT_DIRECTIONS) {
        const rows = ctx.userRepository.searchUsers(
          query({ sortField, sortDirection, limit: 100 }),
        );
        const expected = expectedOrder(ctx.oracle, sortField, sortDirection).slice(0, 100);
        expect(
          rows.map((row) => row.id),
          `${sortField} ${sortDirection}`,
        ).toEqual(expected.map((user) => user.id));
      }
    }
  });

  it('keeps the id tie-breaker ASCENDING even when the sort is DESC', () => {
    // Reversing the tie-breaker along with the primary key is an easy mistake
    // that still looks sorted — and it is what actually breaks pagination.
    // `nationality` has the heaviest tie groups, so it exposes it fastest.
    for (const sortDirection of SORT_DIRECTIONS) {
      const rows = ctx.userRepository.searchUsers(
        query({ sortField: 'nationality', sortDirection, limit: 100 }),
      );

      for (let i = 1; i < rows.length; i++) {
        const prev = rows[i - 1]!;
        const cur = rows[i]!;
        if (prev.nationality.toLowerCase() === cur.nationality.toLowerCase()) {
          expect(cur.id, `tie group under ${sortDirection}`).toBeGreaterThan(prev.id);
        }
      }
    }
  });

  it('is stable across identical requests', () => {
    const q = query({ sortField: 'nationality', sortDirection: 'desc', limit: 25, page: 3 });
    const first = ctx.userRepository.searchUsers(q).map((row) => row.id);
    const second = ctx.userRepository.searchUsers(q).map((row) => row.id);
    expect(second).toEqual(first);
  });
});

describe('pagination', () => {
  it('produces no duplicates and skips nothing, for every sort and page size', () => {
    for (const sortField of SORT_FIELDS) {
      for (const sortDirection of SORT_DIRECTIONS) {
        for (const limit of [7, 50]) {
          const ids = walk({ sortField, sortDirection }, limit);
          const label = `${sortField}/${sortDirection}/limit=${limit}`;

          expect(new Set(ids).size, `${label}: duplicates`).toBe(ids.length);
          expect(ids.length, `${label}: missing`).toBe(ctx.oracle.length);

          // Order, not just membership.
          expect(ids, `${label}: order`).toEqual(
            expectedOrder(ctx.oracle, sortField, sortDirection).map((user) => user.id),
          );
        }
      }
    }
  });

  it('walks a filtered set exactly', () => {
    const nationality = ctx.oracle[0]!.nationality;
    const overrides = { nationalities: [nationality], sortField: 'age' as const };

    for (const limit of [5, 13]) {
      const ids = walk(overrides, limit);
      expect(new Set(ids).size).toBe(ids.length);
      expect([...ids].sort((a, b) => a - b)).toEqual(
        expectedUsers(ctx.oracle, overrides)
          .map((user) => user.id)
          .sort((a, b) => a - b),
      );
    }
  });

  it('returns an empty page past the end without disturbing the total', () => {
    const q = query({ page: 999, limit: 50 });
    expect(ctx.userRepository.searchUsers(q)).toEqual([]);
    expect(ctx.userRepository.countUsers(q)).toBe(ctx.oracle.length);
  });

  it('counts independently of paging', () => {
    // countUsers must ignore page/limit entirely — if it ever applied them the
    // UI would report the page size as the result count.
    const base = ctx.userRepository.countUsers(query({ page: 1, limit: 10 }));
    expect(ctx.userRepository.countUsers(query({ page: 4, limit: 100 }))).toBe(base);
  });
});
