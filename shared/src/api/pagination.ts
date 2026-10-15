/**
 * Keyset (cursor) pagination envelope.
 *
 * The client never asks for "page N". It sends back the opaque `nextCursor`
 * from the previous response, which encodes the last row it received, and the
 * server returns the rows that sort *after* that row. Two consequences:
 *
 *  - every page costs the same: the database seeks to the position through
 *    the sort index instead of reading and discarding OFFSET rows;
 *  - rows inserted or deleted while the user scrolls cannot shift the window,
 *    so nothing is shown twice and nothing is skipped.
 *
 * The price is that there is no random access: "jump to page 40" cannot be
 * expressed. Infinite scroll never needs it.
 */

export interface PaginationMeta {
  /** Page size that produced this payload. */
  limit: number;
  /** Total rows matching the current search + filters (not the whole table). */
  total: number;
  /** Convenience flag; always equal to `nextCursor !== null`. */
  hasMore: boolean;
  /**
   * Pass back as `?cursor=` to get the next page; `null` on the last page.
   * Opaque: clients must not parse or build it.
   */
  nextCursor: string | null;
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

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;
