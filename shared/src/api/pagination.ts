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

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;
