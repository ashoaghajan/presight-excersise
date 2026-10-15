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
  nocase,
  query,
  walkIds,
  type TestContext,
} from '../test/fixture';

let ctx: TestContext;

beforeAll(() => {
  ctx = createTestContext();
});

afterAll(() => ctx.close());

/** Walks every page of a query with keyset cursors, as the API does. */
function walk(overrides: Parameters<typeof query>[0], limit: number): number[] {
  return walkIds(ctx.userRepository, overrides, limit);
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
    const q = query({
      sortField: 'nationality',
      sortDirection: 'desc',
      limit: 25,
      after: { value: 'India', id: 50 },
    });
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

  it('returns an empty page after the last row without disturbing the total', () => {
    const last = expectedOrder(ctx.oracle, 'first_name', 'asc').at(-1)!;
    const q = query({ after: { value: last.first_name, id: last.id } });

    expect(ctx.userRepository.searchUsers(q)).toEqual([]);
    expect(ctx.userRepository.countUsers(q)).toBe(ctx.oracle.length);
  });

  it('counts independently of the cursor and limit', () => {
    // countUsers must ignore cursor/limit entirely — if it ever applied them
    // the UI would report "rows left" or the page size as the result count.
    const base = ctx.userRepository.countUsers(query({ limit: 10 }));
    expect(ctx.userRepository.countUsers(query({ limit: 100, after: { value: 'M', id: 1 } }))).toBe(
      base,
    );
  });

  it('starts strictly after the cursor row, inside a tie group too', () => {
    // Nationality has the largest tie groups. Starting in the middle of one
    // checks the `id > ?` half of the keyset condition.
    const order = expectedOrder(ctx.oracle, 'nationality', 'desc');
    const index = order.findIndex(
      (user, i) => i > 0 && user.nationality === order[i - 1]!.nationality,
    );
    const cursorRow = order[index]!;

    const rows = ctx.userRepository.searchUsers(
      query({
        sortField: 'nationality',
        sortDirection: 'desc',
        limit: 10,
        after: { value: cursorRow.nationality, id: cursorRow.id },
      }),
    );

    expect(rows.map((row) => row.id)).toEqual(
      order.slice(index + 1, index + 11).map((user) => user.id),
    );
  });
});

describe('pagination while the data changes', () => {
  // The real reason for keyset pagination. With OFFSET, page N means "skip
  // N * limit rows *as the table is now*", so a row inserted before the
  // current position pushes an already-seen row onto the next page (a
  // duplicate), and a deleted row pulls an unseen one back (a gap). A cursor
  // means "after this exact row", which other writes cannot move.
  //
  // Each test gets its own database because it writes to it.

  const insertUser = (c: TestContext, firstName: string): number =>
    Number(
      c.db
        .prepare(
          `INSERT INTO users (avatar, first_name, last_name, age, nationality)
           VALUES ('a.svg', ?, 'Inserted', 30, 'Testland')`,
        )
        .run(firstName).lastInsertRowid,
    );

  it('shows no duplicates and skips nothing when rows are inserted mid-scroll', () => {
    const c = createTestContext();
    try {
      const original = expectedOrder(c.oracle, 'first_name', 'asc').map((user) => user.id);
      let before = 0;
      let after = 0;

      const ids = walkIds(c.userRepository, { sortField: 'first_name' }, 20, (pageIndex) => {
        if (pageIndex !== 3) return;
        // One row sorting before everything already seen, one after
        // everything. Under OFFSET the first would shift the window and
        // repeat a row on the next page.
        before = insertUser(c, 'Aaaaa');
        after = insertUser(c, 'Zzzzz');
      });

      expect(new Set(ids).size, 'duplicates').toBe(ids.length);
      expect(
        ids.filter((id) => id !== after),
        'original rows, in order',
      ).toEqual(original);
      expect(ids).not.toContain(before); // sorts before the cursor: correctly not shown
      expect(ids.at(-1)).toBe(after); // sorts after the cursor: shown, at the end
    } finally {
      c.close();
    }
  });

  it('skips nothing when an already-seen row is deleted mid-scroll', () => {
    const c = createTestContext();
    try {
      const original = expectedOrder(c.oracle, 'age', 'desc').map((user) => user.id);

      const ids = walkIds(
        c.userRepository,
        { sortField: 'age', sortDirection: 'desc' },
        20,
        (pageIndex) => {
          // Delete a row from page 1. Under OFFSET every later row would move
          // up by one and the first row of the next page would never be shown.
          if (pageIndex === 2) c.db.prepare('DELETE FROM users WHERE id = ?').run(original[5]);
        },
      );

      expect(ids).toEqual(original);
    } finally {
      c.close();
    }
  });

  it('keeps a full-text search walk exact while matching rows are written', () => {
    // Cursor + FTS5 + triggers together: the search runs through the trigram
    // index (3+ characters), the order is DESC, and mid-scroll writes reach
    // the index only through the triggers from migration 002.
    const c = createTestContext();
    try {
      // The most common 3-letter substring, so the search spans many pages.
      const frequency = new Map<string, number>();
      for (const user of c.oracle) {
        const name = nocase(user.first_name);
        for (const tri of new Set(
          Array.from({ length: name.length - 2 }, (_, i) => name.slice(i, i + 3)),
        )) {
          if (!tri.includes(' ')) frequency.set(tri, (frequency.get(tri) ?? 0) + 1);
        }
      }
      const term = [...frequency].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]![0];
      const matches = expectedOrder(expectedUsers(c.oracle, { search: term }), 'last_name', 'desc');
      expect(matches.length).toBeGreaterThan(10);

      // An unseen match whose last name does not contain the term, so
      // renaming its first name makes it stop matching.
      const renamed = matches
        .slice(-5)
        .find((user) => !nocase(user.last_name).includes(nocase(term)))!;
      expect(renamed).toBeDefined();

      const insert = (firstName: string, lastName: string): number =>
        Number(
          c.db
            .prepare(
              `INSERT INTO users (avatar, first_name, last_name, age, nationality)
               VALUES ('a.svg', ?, ?, 30, 'Testland')`,
            )
            .run(firstName, lastName).lastInsertRowid,
        );

      let beforeCursor = 0;
      let afterCursor = 0;

      const ids = walkIds(
        c.userRepository,
        { search: term, sortField: 'last_name', sortDirection: 'desc' },
        5,
        (pageIndex) => {
          if (pageIndex !== 2) return;
          // DESC by last name: "Zzzz" sorts before the cursor, "Aaaa" after.
          beforeCursor = insert(`Q${term}q`, 'Zzzz');
          afterCursor = insert(`Q${term}q`, 'Aaaa');
          c.db.prepare(`UPDATE users SET first_name = 'Qqqq' WHERE id = ?`).run(renamed.id);
        },
      );

      expect(new Set(ids).size, 'duplicates').toBe(ids.length);
      expect(ids).toEqual([
        ...matches.filter((user) => user.id !== renamed.id).map((user) => user.id),
        afterCursor,
      ]);
      expect(ids).not.toContain(beforeCursor);
    } finally {
      c.close();
    }
  });

  it('documents the OFFSET bug the cursor fixes', () => {
    // Not testing our code: a reference showing what the old implementation
    // did in the scenario above, so the tests explain *why* cursors exist.
    const c = createTestContext();
    try {
      const page = (offset: number) =>
        c.db
          .prepare<[number], { id: number }>(
            'SELECT id FROM users ORDER BY first_name, id LIMIT 20 OFFSET ?',
          )
          .all(offset)
          .map((row) => row.id);

      const first = page(0);
      insertUser(c, 'Aaaaa');
      const second = page(20);

      expect(second[0]).toBe(first.at(-1)); // the last row of page 1, shown again
    } finally {
      c.close();
    }
  });
});
