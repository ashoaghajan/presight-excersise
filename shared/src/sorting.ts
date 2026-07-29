/**
 * Sorting vocabulary shared by the API and the client's sort controls.
 *
 * The lists below are exported as runtime values (not just types) so that the
 * server can validate untrusted query strings against them and the client can
 * render the sort dropdown from the same source.
 */

/** Fields the directory can be sorted by. */
export const SORT_FIELDS = ['first_name', 'last_name', 'age', 'nationality'] as const;

export type SortField = (typeof SORT_FIELDS)[number];

export const SORT_DIRECTIONS = ['asc', 'desc'] as const;

export type SortDirection = (typeof SORT_DIRECTIONS)[number];

export const DEFAULT_SORT_FIELD: SortField = 'first_name';
export const DEFAULT_SORT_DIRECTION: SortDirection = 'asc';

/**
 * Every ordering must end with `id` so that pagination is stable: rows with
 * equal sort values would otherwise be free to swap places between page
 * requests, producing duplicated or skipped users during infinite scroll.
 * The repository layer is responsible for appending this tie-breaker.
 */
export const SORT_TIE_BREAKER = 'id' as const;

export function isSortField(value: unknown): value is SortField {
  return typeof value === 'string' && (SORT_FIELDS as readonly string[]).includes(value);
}

export function isSortDirection(value: unknown): value is SortDirection {
  return typeof value === 'string' && (SORT_DIRECTIONS as readonly string[]).includes(value);
}
