/**
 * User repository — the ONLY place allowed to contain SQL for the users table.
 *
 * Responsibilities:
 *  - translate a validated `UsersQuery` into a parameterised SQL statement
 *  - apply search (first_name / last_name), nationality OR-filter and hobby
 *    AND-filter — all via `buildUserFilter`, never re-derived here
 *  - apply `ORDER BY <sortField> <direction>, id ASC`, the keyset cursor
 *    ("rows after this one") and LIMIT
 *  - return persistence-shaped rows; no DTO shaping, no HTTP concerns
 */

import {
  SORT_DIRECTIONS,
  SORT_FIELDS,
  type KeysetPosition,
  type SortDirection,
  type SortField,
} from '@presight/shared';
import type { UsersQuery } from '@presight/shared';

import { getDb } from '../db';
import type { UserRow, UserWithHobbies } from '../types/domain';
import { buildUserFilter } from './user-filter';
import { createStatementCache } from './statement-cache';

export interface UserRepository {
  /** One page of users matching the query, ordered deterministically. */
  searchUsers(query: UsersQuery): UserWithHobbies[];
  /** Total users matching the same filters, ignoring cursor/limit. */
  countUsers(query: UsersQuery): number;
}

/**
 * Maps a sort field onto the column it orders by.
 *
 * This lookup is the whole defence against injection through `sortField`:
 * SQLite can bind *values* but not *identifiers*, so the ORDER BY column has to
 * be part of the SQL text. Rather than interpolating the caller's string, we
 * only ever emit a constant taken from this table — an unknown key cannot
 * produce SQL at all.
 */
const SORT_COLUMNS: Record<SortField, string> = {
  first_name: 'u.first_name',
  last_name: 'u.last_name',
  age: 'u.age',
  nationality: 'u.nationality',
};

/**
 * Builds the ORDER BY clause.
 *
 * `u.id ASC` is appended unconditionally. Without it, rows with equal sort
 * values are free to come back in any order, and two requests for consecutive
 * pages can return the same user twice — or skip one entirely — while the user
 * is scrolling. It also makes `(sortValue, id)` unique, which is what lets a
 * keyset cursor name an exact position.
 *
 * The sort columns are declared COLLATE NOCASE in the schema, so ordering is
 * case-insensitive without a per-query COLLATE.
 */
function sortColumn(field: SortField): string {
  // Defensive re-validation: these values are typed, but they are also the one
  // thing in this file that reaches the SQL text, so cheap paranoia is worth it.
  return SORT_FIELDS.includes(field) ? SORT_COLUMNS[field] : SORT_COLUMNS.first_name;
}

function isDescending(direction: SortDirection): boolean {
  return SORT_DIRECTIONS.includes(direction) && direction === 'desc';
}

function buildOrderBy(field: SortField, direction: SortDirection): string {
  return `ORDER BY ${sortColumn(field)} ${isDescending(direction) ? 'DESC' : 'ASC'}, u.id ASC`;
}

/**
 * "Rows strictly after `after`" in the order `buildOrderBy` produces.
 *
 * For `ORDER BY col ASC, id ASC` the rows after (v, i) are those with
 * `col > v`, or `col = v AND id > i`. For DESC the column comparison flips but
 * the id comparison does not, because the tie-breaker stays ascending. That
 * mixed direction is why SQLite's row-value form `(col, id) > (?, ?)` cannot
 * be used here.
 *
 * It is written as `col >= v AND (col > v OR id > i)` rather than the plain
 * OR: the two are equivalent, but the leading `col >= v` is a range condition
 * SQLite can SEEK to in the `(col, id)` index. A top-level OR would make it
 * scan from the start of the index, which is the OFFSET cost all over again.
 *
 * The comparison inherits the column's NOCASE collation, so it agrees with
 * the ORDER BY on what "after" means.
 */
function buildKeysetCondition(
  field: SortField,
  direction: SortDirection,
  after: KeysetPosition,
): { sql: string; params: (string | number)[] } {
  const column = sortColumn(field);
  const [orEqual, strictly] = isDescending(direction) ? ['<=', '<'] : ['>=', '>'];

  return {
    sql: `${column} ${orEqual} ? AND (${column} ${strictly} ? OR u.id > ?)`,
    params: [after.value, after.value, after.id],
  };
}

/**
 * Factory instead of a class: there is no per-instance state beyond the
 * connection, and a plain object keeps the seam easy to fake in tests.
 */
export function createUserRepository(db = getDb()): UserRepository {
  const statements = createStatementCache(db);

  /**
   * Loads the hobbies for exactly the users on the current page.
   *
   * Deliberately a second query rather than a join or `group_concat` on the
   * main one:
   *  - a join would multiply the page rows by their hobby count, breaking
   *    LIMIT;
   *  - `group_concat` would need a delimiter, and any hobby containing that
   *    delimiter would corrupt the result on the way back.
   *
   * Two round trips, both index-driven, with no per-row N+1.
   */
  function loadHobbies(userIds: number[]): Map<number, string[]> {
    const byUser = new Map<number, string[]>();
    if (userIds.length === 0) return byUser;

    const rows = statements
      .prepare<{ user_id: number; name: string }>(
        `SELECT uh.user_id, h.name
           FROM user_hobbies uh
           JOIN hobbies h ON h.id = uh.hobby_id
          WHERE uh.user_id IN (${new Array(userIds.length).fill('?').join(', ')})
          ORDER BY uh.user_id, h.name`,
      )
      .all(...userIds);

    for (const row of rows) {
      const existing = byUser.get(row.user_id);
      if (existing) existing.push(row.name);
      else byUser.set(row.user_id, [row.name]);
    }

    return byUser;
  }

  return {
    searchUsers(query: UsersQuery): UserWithHobbies[] {
      const filter = buildUserFilter(query);
      const orderBy = buildOrderBy(query.sortField, query.sortDirection);
      const keyset = query.after
        ? buildKeysetCondition(query.sortField, query.sortDirection, query.after)
        : null;

      const limit = Math.max(1, query.limit);

      const rows = statements
        .prepare<UserRow>(
          `SELECT u.id, u.avatar, u.first_name, u.last_name, u.age, u.nationality
             FROM users u
            WHERE ${filter.sql}
              ${keyset ? `AND ${keyset.sql}` : ''}
            ${orderBy}
            LIMIT ?`,
        )
        // Filter parameters first, then the cursor, then LIMIT — the order has
        // to match the placeholder order in the SQL above.
        .all(...filter.params, ...(keyset?.params ?? []), limit);

      const hobbiesByUser = loadHobbies(rows.map((row) => row.id));

      return rows.map((row) => ({ ...row, hobbies: hobbiesByUser.get(row.id) ?? [] }));
    },

    countUsers(query: UsersQuery): number {
      const filter = buildUserFilter(query);

      const row = statements
        .prepare<{ count: number }>(
          `SELECT COUNT(*) AS count
             FROM users u
            WHERE ${filter.sql}`,
        )
        .get(...filter.params);

      return row?.count ?? 0;
    },
  };
}
