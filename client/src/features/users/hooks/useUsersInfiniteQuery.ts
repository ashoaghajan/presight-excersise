/**
 * The feature's data hook: one infinite query keyed by the URL state.
 *
 * This is the seam where the query client, the API layer and the URL state meet.
 * Components consume its result; they never call `getUsers` or build a query
 * key themselves.
 *
 * Note what it returns beyond the rows: the facet counts come back inside the
 * *same* response as the page, so the sidebar reads them from here rather than
 * issuing its own request. That is what guarantees the counts and the visible
 * list always describe the same filtered set.
 */

import { useCallback, useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { FacetCount, UserDto, UsersResponse } from '@presight/shared';

import type { ApiError } from '@/shared/api';

import { getUsers } from '../api/get-users';
import { usersKeys } from '../api/query-keys';
import { USERS_PAGE_SIZE } from '../model/list-config';
import type { UsersQueryState } from '../model/users-query';

export interface UseUsersInfiniteQueryResult {
  /** Every loaded page flattened — what the virtualizer renders. */
  users: UserDto[];
  /** Total matching the current filters, for the result count. */
  total: number;
  /** Facets from the most recent page; always in step with `users`. */
  hobbies: FacetCount[];
  nationalities: FacetCount[];

  /** First load, nothing to show yet → skeletons. */
  isInitialLoading: boolean;
  /** Appending a page → bottom-of-list spinner, list stays interactive. */
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;

  isError: boolean;
  error: ApiError | null;
  refetch: () => void;
  /** No data, not fetching — stalled rather than failed. See below. */
  isStalled: boolean;
}

export function useUsersInfiniteQuery(state: UsersQueryState): UseUsersInfiniteQueryResult {
  const query = useInfiniteQuery<UsersResponse, ApiError>({
    queryKey: usersKeys.list(state),
    queryFn: ({ pageParam, signal }) =>
      getUsers({ ...state, page: pageParam as number, limit: USERS_PAGE_SIZE }, signal),
    initialPageParam: 1,
    /**
     * Declared here as well as in the query client's defaults, so the behaviour
     * is unambiguous at the point it matters.
     *
     * `always` = never pause on a connectivity guess; attempt the request and
     * report a real error. See the longer note in `app/providers/query-client`.
     */
    networkMode: 'always',
    // The server's `hasMore` is authoritative — it is derived from the total
    // rather than from "was the page full", so trusting it means never
    // fetching a trailing empty page just to discover the end.
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? lastPage.pagination.page + 1 : undefined,
  });

  const pages = query.data?.pages;

  // Flattened once per data change, not once per render. The virtualizer
  // re-renders its consumer on every scroll frame, and a fresh array identity
  // each time would invalidate every downstream memo and defeat `React.memo`
  // on the cards.
  const users = useMemo(() => (pages ?? []).flatMap((page) => page.users), [pages]);

  // Facets and total are identical across pages of one query; the newest page
  // is used so a background refetch surfaces updated counts.
  const latest = pages?.at(-1);

  // Stable identity so `fetchNextPage` can be a dependency of the scroll effect
  // without re-subscribing on every render.
  const fetchNextPage = useCallback(() => {
    // Guarded here rather than at every call site: the scroll handler fires
    // repeatedly near the end of the list and would otherwise queue duplicate
    // requests for the same page.
    if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
  }, [query]);

  return {
    users,
    total: latest?.pagination.total ?? 0,
    hobbies: latest?.hobbies ?? [],
    nationalities: latest?.nationalities ?? [],

    // `isPending` covers "no data at all yet"; `isFetchingNextPage` is excluded
    // so appending a page never blanks the list back to skeletons. A *paused*
    // query is pending but making no progress, so it is not "loading".
    isInitialLoading: query.isPending && query.fetchStatus !== 'paused',
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage,
    fetchNextPage,

    isError: query.isError,
    error: query.error ?? null,

    /**
     * True when the query has no data and is not actively fetching — i.e. it
     * has stalled rather than failed. React Query can enter this state by
     * pausing a retry (see `networkMode` in the query client), and without an
     * explicit flag the UI would sit on skeletons forever with no error to
     * show. Treated as a failure by the page, because from the user's side it
     * is one.
     */
    isStalled: query.isPending && query.fetchStatus === 'paused',
    refetch: () => void query.refetch(),
  };
}
