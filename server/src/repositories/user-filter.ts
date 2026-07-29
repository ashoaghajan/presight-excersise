/**
 * The single source of truth for "which users match this query".
 *
 * Every repository method — the page, the total count, and both facet lists —
 * builds its WHERE clause from this one function. That is not a style
 * preference: if the page query and the count query construct their predicates
 * independently, they *will* drift, and the UI ends up claiming "312 results"
 * while scrolling through a different set. Build once, reuse four times.
 *
 * Everything here is parameterised. No caller-supplied value is ever
 * concatenated into SQL — only `?` placeholders are generated, and the values
 * travel beside them in `params`.
 */

import type { UsersQuery } from '@presight/shared';

/** The three independent dimensions the filter is built from. */
export type FilterDimension = 'search' | 'nationalities' | 'hobbies';

export interface BuildUserFilterOptions {
  /**
   * Omit one dimension from the predicate.
   *
   * Used for **disjunctive faceting**: a facet list that excludes its own
   * filter, so the user can still see (and add) sibling options after selecting
   * one. See `facet.repository.ts` for why nationality requires this and hobby
   * does not.
   */
  exclude?: FilterDimension;
}

/** A SQL boolean expression plus the values its placeholders bind to. */
export interface SqlPredicate {
  /** Always a valid boolean expression, so callers can write `WHERE ${sql}`. */
  sql: string;
  /**
   * Bind values in placeholder order. Callers append their own trailing
   * parameters (LIMIT / OFFSET) *after* spreading these.
   */
  params: (string | number)[];
}

/**
 * Escapes the wildcards SQLite's LIKE treats as special.
 *
 * Without this, a user typing `%` matches every row and `_` silently matches
 * any single character — the search box would behave like a pattern language
 * nobody asked for. The paired `ESCAPE '\'` in the SQL below activates this.
 */
function escapeLikeWildcards(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * Removes blanks and case-insensitive duplicates.
 *
 * The route validator is expected to do this too, but the repository must not
 * *depend* on it: a duplicated hobby would inflate the AND-filter's required
 * match count (see below) and silently return zero rows.
 */
function normaliseValues(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    if (trimmed === '') continue;

    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(trimmed);
  }

  return result;
}

/** `?, ?, ?` for an IN list of the given length. */
function placeholders(count: number): string {
  return new Array(count).fill('?').join(', ');
}

/**
 * Builds the shared predicate over the `users` table, aliased as `u`.
 *
 * The three filters combine with AND — a user must match the search *and* be
 * from one of the selected nationalities *and* have all the selected hobbies.
 */
export function buildUserFilter(
  query: UsersQuery,
  options: BuildUserFilterOptions = {},
): SqlPredicate {
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  const includes = (dimension: FilterDimension): boolean => options.exclude !== dimension;

  // --- Search: first_name OR last_name -------------------------------------
  //
  // Substring match, so "ann" finds both "Ananya" and "Hannah". The columns are
  // declared COLLATE NOCASE, so this is already case-insensitive without
  // LOWER() — which matters, because wrapping a column in a function is exactly
  // what stops an index from being usable.
  const search = query.search.trim();
  if (search !== '' && includes('search')) {
    conditions.push(`(u.first_name LIKE ? ESCAPE '\\' OR u.last_name LIKE ? ESCAPE '\\')`);
    const pattern = `%${escapeLikeWildcards(search)}%`;
    params.push(pattern, pattern);
  }

  // --- Nationalities: OR ---------------------------------------------------
  //
  // "UAE + UK" means nationality = UAE OR nationality = UK. A single row holds
  // exactly one nationality, so the selected values are alternatives for the
  // same column and `IN (...)` expresses that directly — it is literally a
  // chain of ORs, and SQLite can drive it from idx_users_nationality.
  const nationalities = normaliseValues(query.nationalities);
  if (nationalities.length > 0 && includes('nationalities')) {
    conditions.push(`u.nationality IN (${placeholders(nationalities.length)})`);
    params.push(...nationalities);
  }

  // --- Hobbies: AND --------------------------------------------------------
  //
  // "Reading + Swimming" means the user must have BOTH, not either. Hobbies
  // live in a separate row per user, so this cannot be expressed as a condition
  // on a single row the way nationality can — a plain `h.name IN (...)` join
  // would return anyone with *at least one* of them, which is the OR semantics
  // we explicitly do not want.
  //
  // The subquery gathers every user who has any of the selected hobbies,
  // groups by user, and keeps only those whose distinct match count equals the
  // number of hobbies asked for. A user with 2 of 2 passes; a user with 1 of 2
  // is filtered out by the HAVING clause.
  //
  // Written as one uncorrelated subquery rather than N correlated EXISTS
  // clauses, for two reasons:
  //   1. it is evaluated once and reused, instead of re-probing per candidate
  //      row;
  //   2. the outer query stays a plain row filter with no GROUP BY, which is
  //      what lets ORDER BY / LIMIT / OFFSET keep using the sort indexes and
  //      lets this same predicate drop unchanged into the facet queries.
  //
  // COUNT(DISTINCT ...) rather than COUNT(*) is belt-and-braces: the join
  // cannot currently produce duplicates (user_hobbies is keyed by
  // (user_id, hobby_id) and hobbies.name is UNIQUE), but the count is the
  // correctness condition of the whole filter, so it should not depend on that
  // remaining true.
  const hobbies = normaliseValues(query.hobbies);
  if (hobbies.length > 0 && includes('hobbies')) {
    conditions.push(`
      u.id IN (
        SELECT uh.user_id
          FROM user_hobbies uh
          JOIN hobbies h ON h.id = uh.hobby_id
         WHERE h.name IN (${placeholders(hobbies.length)})
         GROUP BY uh.user_id
        HAVING COUNT(DISTINCT uh.hobby_id) = ?
      )`);
    params.push(...hobbies, hobbies.length);
  }

  // `1 = 1` keeps `WHERE ${sql}` valid when nothing is filtered. SQLite folds
  // it away during planning, so it costs nothing.
  return {
    sql: conditions.length > 0 ? conditions.join('\n       AND ') : '1 = 1',
    params,
  };
}
