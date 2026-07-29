/**
 * `GET /api/users` — the only data endpoint the directory needs.
 *
 * The list page and the sidebar facets are served by a single request on
 * purpose: both must describe the *same* filtered result set, and splitting
 * them into two endpoints makes it possible for the UI to show counts that
 * disagree with the visible rows.
 */

import type { FacetCount } from './facets';
import type { PaginationMeta } from './pagination';
import type { SortDirection, SortField } from '../sorting';

/** A single user as exposed over the wire. */
export interface UserDto {
  id: number;
  avatar: string;
  first_name: string;
  last_name: string;
  age: number;
  nationality: string;
  /** All hobby names for the user; the card shows the first two plus `+n`. */
  hobbies: string[];
}

/**
 * Parsed, validated query parameters for `GET /api/users`.
 *
 * Note the deliberate asymmetry in filter semantics, which the repository layer
 * must implement:
 *  - `nationalities` — OR  (user is from any of the selected nationalities)
 *  - `hobbies`      — AND  (user has every selected hobby)
 */
export interface UsersQuery {
  page: number;
  limit: number;
  /** Free-text match against first_name / last_name. Empty string = no search. */
  search: string;
  hobbies: string[];
  nationalities: string[];
  sortField: SortField;
  sortDirection: SortDirection;
}

/**
 * The raw, untrusted shape as it arrives on the query string. Everything is a
 * string (or repeated string) until the route layer validates it into
 * `UsersQuery`. Kept here so the client can build URLs from the same key names.
 */
export interface UsersQueryParams {
  page?: string;
  limit?: string;
  search?: string;
  /** Repeatable: `?hobbies=Reading&hobbies=Swimming`. */
  hobbies?: string | string[];
  /** Repeatable: `?nationalities=UAE&nationalities=India`. */
  nationalities?: string | string[];
  sortField?: string;
  sortDirection?: string;
}

/** Canonical query-string keys, shared with the client's URL-state hook. */
export const USERS_QUERY_KEYS = {
  page: 'page',
  limit: 'limit',
  search: 'search',
  hobbies: 'hobbies',
  nationalities: 'nationalities',
  sortField: 'sortField',
  sortDirection: 'sortDirection',
} as const;

/**
 * Upper bound on how many values one filter may carry.
 *
 * Each selected value becomes a bound parameter in an `IN (...)` list, so an
 * unbounded array is a cheap way for a client to make the server build an
 * enormous statement. The sidebar only ever offers 20 of each, so 50 is
 * generous.
 */
export const MAX_FILTER_VALUES = 50;

/** Upper bound on the search term, for the same reason. */
export const MAX_SEARCH_LENGTH = 100;

/**
 * Highest accepted `page`. Offsets grow linearly with it, so an arbitrarily
 * large page number is another cheap way to make the database do pointless
 * work. Far beyond any real dataset here.
 */
export const MAX_PAGE = 1_000_000;

export interface UsersResponse {
  /** The requested page of users. */
  users: UserDto[];
  pagination: PaginationMeta;
  /**
   * Top 20 hobbies **for the current result set**, not the whole table — these
   * are facet counts for the sidebar, not any single user's hobbies.
   */
  hobbies: FacetCount[];
  /** Top 20 nationalities for the current result set. */
  nationalities: FacetCount[];
}
