/**
 * Facet repository — SQL for the sidebar's top-N hobby and nationality counts.
 *
 * Split from `user.repository` because the two answer different questions over
 * the same predicate: "which rows are on this page" vs "how is the whole
 * matching set distributed". Keeping them separate stops the page query from
 * growing aggregation clauses it does not need.
 *
 * Critical semantics:
 *  - counts are computed over the *filtered* set, never over the whole table —
 *    which is why both methods take the full `UsersQuery` and run it through the
 *    same `buildUserFilter` the page query uses;
 *  - each list is capped by the caller (`FACET_LIMIT` = 20), ordered by count
 *    DESC and then by value ASC so the sidebar is stable between requests.
 *
 * ## Why nationality excludes its own filter, and hobby does not
 *
 * The asymmetry is forced by the data, not a preference. A user has exactly
 * **one** nationality, so a nationality count computed over a nationality-
 * filtered set can only ever return the selected values themselves: select
 * "India" and the facet list comes back `[India]`, every other checkbox
 * disappears, and the OR filter becomes impossible to add a second value to.
 * The multi-select is unreachable by construction.
 *
 * So the nationality facets exclude the nationality filter while still honouring
 * search and hobbies — standard **disjunctive faceting**. The counts stay
 * meaningful and stay scoped to the query: with India selected, "Japan (57)"
 * reads as "adding Japan brings in 57 more users", which is exactly what OR
 * means.
 *
 * Hobbies need no such treatment. A user has up to ten, so a hobby-filtered set
 * still contains plenty of *other* hobbies — selecting "Reading" leaves
 * "Traveling (91)", "Cooking (83)" and so on visible, and each added hobby
 * narrowing the list is the correct, intended reading of AND. Excluding the
 * hobby filter there would actively mislead: it would advertise counts that the
 * AND semantics will not deliver.
 */

import type { FacetCount, UsersQuery } from '@presight/shared';

import { getDb } from '../db';
import { buildUserFilter } from './user-filter';
import { createStatementCache } from './statement-cache';

export interface FacetRepository {
  /** Most common hobbies within the filtered set, highest count first. */
  getTopHobbies(query: UsersQuery, limit: number): FacetCount[];
  /**
   * Most common nationalities, highest count first, scoped to the search and
   * hobby filters but **not** to the nationality selection — see the note at
   * the top of this file.
   */
  getTopNationalities(query: UsersQuery, limit: number): FacetCount[];
}

export function createFacetRepository(db = getDb()): FacetRepository {
  const statements = createStatementCache(db);

  return {
    getTopNationalities(query: UsersQuery, limit: number): FacetCount[] {
      // Disjunctive: the nationality filter is excluded from its own counts, or
      // selecting one value would hide every other checkbox and make the
      // multi-select unreachable. Search and hobbies still apply.
      const filter = buildUserFilter(query, { exclude: 'nationalities' });

      // One row per user, so a plain GROUP BY over the filtered users is the
      // whole story — no join required.
      //
      // The `value ASC` secondary sort is not cosmetic: without it, facets with
      // equal counts could swap places between two requests for the same query,
      // and checkboxes would appear to jump around in the sidebar.
      return statements
        .prepare<FacetCount>(
          `SELECT u.nationality AS value, COUNT(*) AS count
             FROM users u
            WHERE ${filter.sql}
            GROUP BY u.nationality
            ORDER BY count DESC, value ASC
            LIMIT ?`,
        )
        .all(...filter.params, Math.max(1, limit));
    },

    getTopHobbies(query: UsersQuery, limit: number): FacetCount[] {
      const filter = buildUserFilter(query);

      // Hobbies live one row per (user, hobby), so this joins out to the link
      // table and counts users per hobby name.
      //
      // Note what is being counted: `COUNT(DISTINCT u.id)` — the number of
      // matching *users* who have the hobby, not the number of link rows. They
      // are equal today because (user_id, hobby_id) is unique, but the count is
      // what the UI displays next to a checkbox ("Reading (320)" must mean 320
      // people), so it is stated explicitly rather than inferred from a
      // constraint that could change.
      //
      // The WHERE clause is the identical predicate the page query uses,
      // including the hobby AND-filter — so when "Reading" is selected, this
      // returns the hobbies of Reading-users only, which is exactly the
      // "counts must reflect current filters" requirement.
      return statements
        .prepare<FacetCount>(
          `SELECT h.name AS value, COUNT(DISTINCT u.id) AS count
             FROM users u
             JOIN user_hobbies uh ON uh.user_id = u.id
             JOIN hobbies h ON h.id = uh.hobby_id
            WHERE ${filter.sql}
            GROUP BY h.name
            ORDER BY count DESC, value ASC
            LIMIT ?`,
        )
        .all(...filter.params, Math.max(1, limit));
    },
  };
}
