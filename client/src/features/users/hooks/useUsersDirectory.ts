/**
 * The single hook a screen needs: URL state in, data out.
 *
 * This is where URL state and React Query meet. The composition is the whole
 * point — the query key is derived from the URL state, so **navigation is
 * fetching**. Pressing Back rewrites the query string, which re-parses to a
 * different state, which produces a different query key, which React Query
 * either serves from cache or refetches. No effect, no manual invalidation and
 * no `useEffect` syncing two sources of truth: there is only one.
 *
 * That is also why Back/Forward feel instant — the previous state's key is
 * still in the cache, so returning to it is a cache hit rather than a request.
 *
 * Debouncing lives in `useSearchInput`, between the text box and the URL, not
 * between the URL and the query. That ordering matters: it means the URL only
 * ever holds committed searches, so the address bar always describes what is
 * on screen and a copied link reproduces it exactly.
 */

import { useUsersInfiniteQuery, type UseUsersInfiniteQueryResult } from './useUsersInfiniteQuery';
import { useSearchInput, type UseSearchInputResult } from './useSearchInput';
import { useUsersQueryState, type UseUsersQueryStateResult } from './useUsersQueryState';

export interface UseUsersDirectoryResult {
  /** URL-synced state plus the intent-named actions that update it. */
  query: UseUsersQueryStateResult;
  /** Controlled binding for the search box; see `useSearchInput`. */
  searchInput: UseSearchInputResult;
  /** Server data for the committed state. */
  data: UseUsersInfiniteQueryResult;
}

export function useUsersDirectory(): UseUsersDirectoryResult {
  const query = useUsersQueryState();

  // Only the search term is debounced. Filters and sort are discrete clicks —
  // delaying them would make the UI feel broken, and each is a single request
  // rather than one per keystroke.
  const searchInput = useSearchInput(query.state.search, query.setSearch);

  const data = useUsersInfiniteQuery(query.state);

  return { query, searchInput, data };
}
