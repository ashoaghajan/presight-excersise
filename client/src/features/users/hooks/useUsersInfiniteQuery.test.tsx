/**
 * Tests for the data hook's state machine.
 *
 * The error case is a regression guard for a bug found by stopping the API
 * against a running browser: the query settled at
 * `status=pending / fetchStatus=paused` and the UI showed skeletons forever,
 * never reaching the error state, and `refetch()` was a no-op. The cause was
 * React Query's default `networkMode: 'online'` pausing on a connectivity
 * guess. These specs assert the failure actually surfaces.
 */

import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import type { UsersResponse } from '@presight/shared';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/shared/api';

import * as getUsersModule from '../api/get-users';
import type { UsersQueryState } from '../model/users-query';
import { useUsersInfiniteQuery } from './useUsersInfiniteQuery';

const state: UsersQueryState = {
  search: '',
  hobbies: [],
  nationalities: [],
  sortField: 'first_name',
  sortDirection: 'asc',
};

function makeResponse(overrides: Partial<UsersResponse> = {}): UsersResponse {
  return {
    users: [
      {
        id: 1,
        avatar: '',
        first_name: 'Ada',
        last_name: 'Lovelace',
        age: 36,
        nationality: 'United Kingdom',
        hobbies: ['Reading'],
      },
    ],
    pagination: { limit: 50, total: 1, hasMore: false, nextCursor: null },
    hobbies: [{ value: 'Reading', count: 1 }],
    nationalities: [{ value: 'United Kingdom', count: 1 }],
    ...overrides,
  };
}

let client: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
});

afterEach(() => {
  client.clear();
  vi.restoreAllMocks();
});

describe('success', () => {
  it('exposes users, total and both facet lists', async () => {
    vi.spyOn(getUsersModule, 'getUsers').mockResolvedValue(makeResponse());

    const { result } = renderHook(() => useUsersInfiniteQuery(state), { wrapper });

    await waitFor(() => expect(result.current.isInitialLoading).toBe(false));

    expect(result.current.users).toHaveLength(1);
    expect(result.current.total).toBe(1);
    expect(result.current.hobbies).toEqual([{ value: 'Reading', count: 1 }]);
    expect(result.current.nationalities).toEqual([{ value: 'United Kingdom', count: 1 }]);
    expect(result.current.isError).toBe(false);
  });

  it('keeps the users array referentially stable across re-renders', async () => {
    vi.spyOn(getUsersModule, 'getUsers').mockResolvedValue(makeResponse());

    const { result, rerender } = renderHook(() => useUsersInfiniteQuery(state), { wrapper });
    await waitFor(() => expect(result.current.isInitialLoading).toBe(false));

    const first = result.current.users;
    rerender();

    // The virtualizer re-renders on every scroll frame; a new array identity
    // each time would defeat React.memo on every card.
    expect(result.current.users).toBe(first);
  });

  it('reports hasNextPage from the server cursor', async () => {
    vi.spyOn(getUsersModule, 'getUsers').mockResolvedValue(
      makeResponse({
        pagination: { limit: 50, total: 100, hasMore: true, nextCursor: 'c1' },
      }),
    );

    const { result } = renderHook(() => useUsersInfiniteQuery(state), { wrapper });
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
  });

  it('reports no next page when the server returns no cursor', async () => {
    vi.spyOn(getUsersModule, 'getUsers').mockResolvedValue(makeResponse());

    const { result } = renderHook(() => useUsersInfiniteQuery(state), { wrapper });
    await waitFor(() => expect(result.current.isInitialLoading).toBe(false));
    expect(result.current.hasNextPage).toBe(false);
  });

  it('starts without a cursor and hands back the one the server issued', async () => {
    const spy = vi
      .spyOn(getUsersModule, 'getUsers')
      .mockResolvedValueOnce(
        makeResponse({ pagination: { limit: 50, total: 2, hasMore: true, nextCursor: 'c1' } }),
      )
      .mockResolvedValueOnce(
        makeResponse({
          users: [{ ...makeResponse().users[0]!, id: 2 }],
          pagination: { limit: 50, total: 2, hasMore: false, nextCursor: null },
        }),
      );

    const { result } = renderHook(() => useUsersInfiniteQuery(state), { wrapper });
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));

    result.current.fetchNextPage();
    await waitFor(() => expect(result.current.users).toHaveLength(2));

    expect(spy.mock.calls[0]![0]).toMatchObject({ cursor: null });
    expect(spy.mock.calls[1]![0]).toMatchObject({ cursor: 'c1' });
    expect(result.current.users.map((user) => user.id)).toEqual([1, 2]);
    expect(result.current.hasNextPage).toBe(false);
  });
});

describe('failure', () => {
  it('reaches the error state rather than loading forever', async () => {
    vi.spyOn(getUsersModule, 'getUsers').mockRejectedValue(
      new ApiError(500, 'INTERNAL_ERROR', 'Server exploded'),
    );

    const { result } = renderHook(() => useUsersInfiniteQuery(state), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    // Without it, these two stay true/false respectively and the UI shows
    // skeletons indefinitely.
    expect(result.current.isInitialLoading).toBe(false);
    expect(result.current.isStalled).toBe(false);
    expect(result.current.error?.message).toBe('Server exploded');
  });

  it('still surfaces the failure when React Query believes it is offline', async () => {
    // The exact condition behind the original bug. With the default
    // `networkMode: 'online'` the query pauses here and never leaves `pending`,
    // so the UI shows skeletons forever with no error and no way to retry.
    onlineManager.setOnline(false);

    try {
      vi.spyOn(getUsersModule, 'getUsers').mockRejectedValue(
        new ApiError(0, 'NETWORK_ERROR', 'Unreachable'),
      );

      const { result } = renderHook(() => useUsersInfiniteQuery(state), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 3000 });
      expect(result.current.isInitialLoading).toBe(false);
    } finally {
      onlineManager.setOnline(true);
    }
  });

  it('recovers when a retry succeeds', async () => {
    const spy = vi
      .spyOn(getUsersModule, 'getUsers')
      .mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', 'Unreachable'))
      .mockResolvedValue(makeResponse());

    const { result } = renderHook(() => useUsersInfiniteQuery(state), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    result.current.refetch();

    await waitFor(() => expect(result.current.isError).toBe(false));
    expect(result.current.users).toHaveLength(1);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
