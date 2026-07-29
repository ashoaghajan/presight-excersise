/**
 * Tests for URL ↔ state synchronisation and history behaviour.
 *
 * These run against jsdom's real History API inside a real `MemoryRouter`
 * replacement (`BrowserRouter` over `window.history`), because back/forward
 * cannot be verified against a mock that has no history stack. `window.history.back()`
 * is asynchronous, so navigation is awaited via `waitFor`.
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import { useUsersQueryState } from './useUsersQueryState';

function wrapper({ children }: { children: ReactNode }) {
  return <BrowserRouter>{children}</BrowserRouter>;
}

/** Renders the hook at a given starting URL. */
function renderAt(url: string) {
  window.history.replaceState(null, '', url);
  return renderHook(() => useUsersQueryState(), { wrapper });
}

const search = () => window.location.search;

beforeEach(() => {
  // Each test starts from a clean history entry.
  window.history.replaceState(null, '', '/');
});

describe('reading state from the URL', () => {
  it('restores state from a direct URL — the deep-linking requirement', () => {
    const { result } = renderAt(
      '/?search=kha&hobbies=Reading&hobbies=Swimming&nationalities=India&sortField=age&sortDirection=desc',
    );

    expect(result.current.state).toEqual({
      search: 'kha',
      hobbies: ['Reading', 'Swimming'],
      nationalities: ['India'],
      sortField: 'age',
      sortDirection: 'desc',
    });
  });

  it('starts from defaults with no query string', () => {
    const { result } = renderAt('/');

    expect(result.current.state).toEqual({
      search: '',
      hobbies: [],
      nationalities: [],
      sortField: 'first_name',
      sortDirection: 'asc',
    });
  });
});

describe('writing state to the URL', () => {
  it('reflects a hobby toggle in the query string', () => {
    const { result } = renderAt('/');

    act(() => result.current.toggleHobby('Reading'));

    expect(search()).toBe('?hobbies=Reading');
    expect(result.current.state.hobbies).toEqual(['Reading']);
  });

  it('accumulates multiple filters as repeated keys', () => {
    const { result } = renderAt('/');

    act(() => result.current.toggleHobby('Reading'));
    act(() => result.current.toggleHobby('Swimming'));
    act(() => result.current.toggleNationality('India'));

    expect(result.current.state.hobbies).toEqual(['Reading', 'Swimming']);
    expect(search()).toContain('hobbies=Reading&hobbies=Swimming');
    expect(search()).toContain('nationalities=India');
  });

  it('untoggles a selected filter', () => {
    const { result } = renderAt('/?hobbies=Reading');

    act(() => result.current.toggleHobby('Reading'));

    expect(result.current.state.hobbies).toEqual([]);
    expect(search()).toBe('');
  });

  it('writes sort changes, omitting defaults', () => {
    const { result } = renderAt('/');

    act(() => result.current.setSort({ field: 'age', direction: 'desc' }));
    expect(search()).toBe('?sortField=age&sortDirection=desc');

    // Returning to the default direction removes the parameter entirely.
    act(() => result.current.setSort({ direction: 'asc' }));
    expect(search()).toBe('?sortField=age');
  });

  it('clears everything on reset', () => {
    const { result } = renderAt('/?search=kha&hobbies=Reading&sortField=age');

    act(() => result.current.reset());

    expect(search()).toBe('');
    expect(result.current.state.hobbies).toEqual([]);
    expect(result.current.state.search).toBe('');
  });
});

describe('browser back and forward', () => {
  it('undoes a filter toggle on Back and reapplies it on Forward', async () => {
    const { result } = renderAt('/');

    act(() => result.current.toggleHobby('Reading'));
    expect(result.current.state.hobbies).toEqual(['Reading']);

    act(() => void window.history.back());
    await waitFor(() => expect(result.current.state.hobbies).toEqual([]));

    act(() => void window.history.forward());
    await waitFor(() => expect(result.current.state.hobbies).toEqual(['Reading']));
  });

  it('steps back through several filter changes one at a time', async () => {
    const { result } = renderAt('/');

    act(() => result.current.toggleHobby('Reading'));
    act(() => result.current.toggleNationality('India'));
    act(() => result.current.setSort({ field: 'age' }));

    expect(result.current.state.sortField).toBe('age');

    act(() => void window.history.back());
    await waitFor(() => expect(result.current.state.sortField).toBe('first_name'));
    expect(result.current.state.nationalities).toEqual(['India']);

    act(() => void window.history.back());
    await waitFor(() => expect(result.current.state.nationalities).toEqual([]));
    expect(result.current.state.hobbies).toEqual(['Reading']);

    act(() => void window.history.back());
    await waitFor(() => expect(result.current.state.hobbies).toEqual([]));
  });

  it('undoes a reset on Back', async () => {
    const { result } = renderAt('/?hobbies=Reading');

    act(() => result.current.reset());
    expect(result.current.state.hobbies).toEqual([]);

    act(() => void window.history.back());
    await waitFor(() => expect(result.current.state.hobbies).toEqual(['Reading']));
  });
});

describe('search history coalescing', () => {
  it('does not add a history entry per keystroke', async () => {
    const { result } = renderAt('/');

    // Simulates typing "kha": the first character opens the search (push), the
    // rest refine it (replace).
    act(() => result.current.setSearch('k'));
    act(() => result.current.setSearch('kh'));
    act(() => result.current.setSearch('kha'));

    expect(result.current.state.search).toBe('kha');

    // One Back should return to the unfiltered list, not to "kh".
    act(() => void window.history.back());
    await waitFor(() => expect(result.current.state.search).toBe(''));
  });

  it('pushes when clearing the search, so Back can undo the clear', async () => {
    const { result } = renderAt('/?search=kha');

    act(() => result.current.setSearch(''));
    expect(result.current.state.search).toBe('');

    act(() => void window.history.back());
    await waitFor(() => expect(result.current.state.search).toBe('kha'));
  });

  it('preserves filters while the search term changes', () => {
    const { result } = renderAt('/?hobbies=Reading&nationalities=India');

    act(() => result.current.setSearch('kha'));

    expect(result.current.state.hobbies).toEqual(['Reading']);
    expect(result.current.state.nationalities).toEqual(['India']);
    expect(result.current.state.search).toBe('kha');
  });
});

describe('refresh restores state', () => {
  it('yields identical state when the hook remounts at the same URL', () => {
    const { result, unmount } = renderAt('/');

    act(() => result.current.toggleHobby('Reading'));
    act(() => result.current.setSearch('kha'));
    act(() => result.current.setSort({ field: 'age', direction: 'desc' }));

    const before = result.current.state;
    const url = window.location.search;
    unmount();

    // Remounting at the same URL is what a page refresh does.
    const { result: after } = renderAt(`/${url}`);
    expect(after.current.state).toEqual(before);
  });
});
