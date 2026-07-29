/**
 * Query key factory for the users feature.
 *
 * Centralised because keys are the cache's identity: a key built inline in one
 * place and slightly differently in another produces two cache entries for the
 * same data, and invalidation silently misses one of them. Every key in this
 * feature descends from `usersKeys.all`, so a single
 * `invalidateQueries({ queryKey: usersKeys.all })` clears the lot.
 */

import type { UsersQueryState } from '../model/users-query';

export const usersKeys = {
  all: ['users'] as const,

  /**
   * The list key includes the full query state, so changing any filter, the
   * search text or the sort produces a distinct cache entry — which is what
   * makes toggling a filter back an instant cache hit rather than a refetch.
   *
   * Arrays are sorted into a canonical order first: selecting Reading then
   * Swimming must hit the same cache entry as selecting them the other way
   * round, since the API returns identical results for both.
   */
  list: (state: UsersQueryState) =>
    [
      ...usersKeys.all,
      'list',
      {
        search: state.search,
        hobbies: [...state.hobbies].sort(),
        nationalities: [...state.nationalities].sort(),
        sortField: state.sortField,
        sortDirection: state.sortDirection,
      },
    ] as const,
} as const;
