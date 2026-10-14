/**
 * Offset pagination envelope.
 *
 * Offset (page/limit) is used rather than cursor pagination because the list is
 * re-sorted on demand by arbitrary columns; combined with the mandatory `id`
 * tie-breaker it stays free of duplicates and gaps, and it keeps the client's
 * "load next page" logic trivial.
 */

export interface PaginationMeta {
  /** 1-based page index that produced this payload. */
  page: number;
  /** Page size that produced this payload. */
  limit: number;
  /** Total rows matching the current search + filters (not the whole table). */
  total: number;
  /** Total number of pages for `total`/`limit`. */
  totalPages: number;
  /** Convenience flag so the client does not have to derive it. */
  hasMore: boolean;
}

/**
 * A position in an ordered result: the sort value and `id` of the last row
 * already returned. "Next page" means rows strictly after this one in
 * `ORDER BY <sortField> <direction>, id ASC`.
 */
export interface KeysetPosition {
  /** The row's value for the active sort field (a number for `age`). */
  value: string | number;
  id: number;
}

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;
