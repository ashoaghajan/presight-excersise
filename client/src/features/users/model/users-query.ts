/**
 * The URL *is* the query state.
 *
 * Search text, selected hobbies and nationalities, sort field and direction are
 * one object — and that object is exactly the argument to `GET /api/users`.
 * It lives in the query string rather than in component state or Zustand, which
 * is what makes reload, deep-linking, sharing and browser back/forward all work
 * without any extra machinery.
 *
 * This module is the codec between the two representations. It is pure — no
 * React, no hooks — so the round trip can be unit-tested directly, and so the
 * rules live in one readable place rather than being spread across components.
 *
 * `page` is deliberately NOT part of the URL state: the list is an infinite
 * scroll, so the page cursor belongs to the query cache, not to a shareable
 * link. Sharing a URL should reopen the same *filters*, not drop the recipient
 * at row 400.
 */

import {
  DEFAULT_SORT_DIRECTION,
  DEFAULT_SORT_FIELD,
  USERS_QUERY_KEYS,
  isSortDirection,
  isSortField,
  type SortDirection,
  type SortField,
} from '@presight/shared';

/** The URL-synced slice of `UsersQuery` — everything except pagination. */
export interface UsersQueryState {
  search: string;
  hobbies: string[];
  nationalities: string[];
  sortField: SortField;
  sortDirection: SortDirection;
}

export const DEFAULT_USERS_QUERY_STATE: UsersQueryState = {
  search: '',
  hobbies: [],
  nationalities: [],
  sortField: DEFAULT_SORT_FIELD,
  sortDirection: DEFAULT_SORT_DIRECTION,
};

/** Repeated keys (`?hobbies=a&hobbies=b`), trimmed and de-duplicated. */
function readList(params: URLSearchParams, key: string): string[] {
  const seen = new Set<string>();
  const values: string[] = [];

  for (const raw of params.getAll(key)) {
    const trimmed = raw.trim();
    if (trimmed === '') continue;

    // Case-insensitive, matching the server's NOCASE columns — so `Reading`
    // and `reading` are one selection here too, and the checkbox state cannot
    // disagree with what the API filtered on.
    const dedupeKey = trimmed.toLowerCase();
    if (seen.has(dedupeKey)) continue;

    seen.add(dedupeKey);
    values.push(trimmed);
  }

  return values;
}

/**
 * Reads view state out of the URL.
 *
 * Unparseable values fall back to their default rather than throwing: a
 * hand-edited or truncated link should still open the directory. (The *server*
 * rejects the same input with a 400 — that asymmetry is intentional. A bad URL
 * is a user accident to absorb; a bad API request is a client bug to surface.)
 */
export function parseUsersQueryState(params: URLSearchParams): UsersQueryState {
  const sortField = params.get(USERS_QUERY_KEYS.sortField);
  const sortDirection = params.get(USERS_QUERY_KEYS.sortDirection);

  return {
    search: params.get(USERS_QUERY_KEYS.search)?.trim() ?? '',
    hobbies: readList(params, USERS_QUERY_KEYS.hobbies),
    nationalities: readList(params, USERS_QUERY_KEYS.nationalities),
    sortField: isSortField(sortField) ? sortField : DEFAULT_SORT_FIELD,
    sortDirection: isSortDirection(sortDirection) ? sortDirection : DEFAULT_SORT_DIRECTION,
  };
}

/**
 * Writes view state back to the URL.
 *
 * Default values are omitted so the common case stays a clean `/` instead of
 * `/?search=&sortField=first_name&sortDirection=asc`. Keys are written in a
 * fixed order and lists in selection order, so the same state always produces
 * the same string — which keeps it usable as a cache key and stops the history
 * stack filling with entries that differ only by parameter order.
 */
export function serializeUsersQueryState(state: UsersQueryState): URLSearchParams {
  const params = new URLSearchParams();

  if (state.search.trim() !== '') params.set(USERS_QUERY_KEYS.search, state.search.trim());

  for (const nationality of state.nationalities) {
    params.append(USERS_QUERY_KEYS.nationalities, nationality);
  }
  for (const hobby of state.hobbies) {
    params.append(USERS_QUERY_KEYS.hobbies, hobby);
  }

  if (state.sortField !== DEFAULT_SORT_FIELD) {
    params.set(USERS_QUERY_KEYS.sortField, state.sortField);
  }
  if (state.sortDirection !== DEFAULT_SORT_DIRECTION) {
    params.set(USERS_QUERY_KEYS.sortDirection, state.sortDirection);
  }

  return params;
}

/** Adds or removes a value, preserving selection order. Pure. */
export function toggleValue(values: readonly string[], value: string): string[] {
  const key = value.toLowerCase();
  return values.some((entry) => entry.toLowerCase() === key)
    ? values.filter((entry) => entry.toLowerCase() !== key)
    : [...values, value];
}

/** True when nothing is filtered — used to pick the right empty state. */
export function isDefaultQueryState(state: UsersQueryState): boolean {
  return state.search === '' && state.hobbies.length === 0 && state.nationalities.length === 0;
}
