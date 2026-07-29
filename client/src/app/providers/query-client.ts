/**
 * TanStack Query client — the app-wide server-state policy.
 *
 * Why a data-fetching library at all: the directory needs paginated fetching
 * with an "is there more?" cursor, request de-duplication while the user types,
 * cache reuse when they navigate back, and separate loading states for the
 * first page vs. subsequent pages. `useInfiniteQuery` provides exactly that,
 * and pairs directly with `@tanstack/react-virtual` for the list.
 *
 * The defaults below are the policy; individual queries override them where it
 * matters.
 */

import { QueryClient } from '@tanstack/react-query';

import { ApiError } from '@/shared/api';

/**
 * Retrying a 4xx is pointless — a 400 from the query validator will fail
 * identically every time, and retrying only delays the error state the user
 * needs to see. Network failures and 5xx are worth one more attempt.
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && !error.isRetryable) return false;
  return failureCount < 2;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      /**
       * `always` rather than the default `online`.
       *
       * With `online`, React Query consults its `onlineManager` before fetching
       * or retrying and *pauses* when it believes the browser is offline: the
       * query stays `pending` forever and never reaches `error`, so a
       * unreachable API renders as an endless skeleton with no way to recover.
       *
       * This API is same-origin (Vite proxy in dev, nginx in Docker) and may
       * well be on localhost, where connectivity heuristics are meaningless.
       * Attempting the request and surfacing a real error is both more honest
       * and more useful than pausing on a guess.
       */
      networkMode: 'always',
      // Directory data is not real-time; avoid refetch storms on tab focus.
      refetchOnWindowFocus: false,
      // A page of users stays fresh long enough to make back-navigation and
      // filter toggling feel instant, without hiding real updates for long.
      staleTime: 30_000,
      // Keep unused pages around briefly so re-selecting a recent filter is a
      // cache hit rather than a round trip.
      gcTime: 5 * 60_000,
      retry: shouldRetry,
      // `throwOnError: false` (the default) is intentional: data errors are
      // rendered as an inline error state with a retry button,
      // not escalated to the render-error boundary, which would replace the
      // whole screen and lose the user's filters.
    },
  },
});
