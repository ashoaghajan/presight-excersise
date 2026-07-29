/**
 * Integration test: the search field wired to the real debounce + URL state.
 *
 * Covers the full chain the page composes — keystrokes → `useSearchInput`
 * debounce → `useUsersQueryState` → query string — which is where the timing
 * bugs live and where neither unit test alone would catch a wiring mistake.
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import { useSearchInput, useUsersQueryState } from '@/features/users/hooks';
import { SEARCH_DEBOUNCE_MS } from '@/features/users/model/list-config';

import { SearchField } from './SearchField';

/** Mirrors how `UserDirectoryPage` wires the field. */
function Harness() {
  const { state, setSearch } = useUsersQueryState();
  const searchInput = useSearchInput(state.search, setSearch);

  return (
    <SearchField
      value={searchInput.value}
      onChange={searchInput.setValue}
      isPending={searchInput.isPending}
    />
  );
}

function renderAt(url: string) {
  window.history.replaceState(null, '', url);
  return render(
    <BrowserRouter>
      <Harness />
    </BrowserRouter>,
  );
}

const params = () => window.location.search;

beforeEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('typing → URL', () => {
  it('does not touch the URL until typing settles', async () => {
    const user = userEvent.setup();
    renderAt('/');

    await user.type(screen.getByRole('searchbox'), 'kha');

    // The field is already up to date …
    expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('kha');
    // … but the URL waits for the debounce, so history is not spammed.
    expect(params()).toBe('');

    await waitFor(() => expect(params()).toBe('?search=kha'), {
      timeout: SEARCH_DEBOUNCE_MS + 1000,
    });
  });

  it('never drops a keystroke, even typed instantly', async () => {
    const user = userEvent.setup({ delay: null });
    renderAt('/');

    await user.type(screen.getByRole('searchbox'), 'abcdefgh');

    expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('abcdefgh');
    await waitFor(() => expect(params()).toBe('?search=abcdefgh'), {
      timeout: SEARCH_DEBOUNCE_MS + 1000,
    });
  });

  it('preserves filters and sort while searching', async () => {
    const user = userEvent.setup();
    renderAt('/?hobbies=Reading&sortField=age');

    await user.type(screen.getByRole('searchbox'), 'kha');

    await waitFor(() => expect(params()).toContain('search=kha'), {
      timeout: SEARCH_DEBOUNCE_MS + 1000,
    });
    expect(params()).toContain('hobbies=Reading');
    expect(params()).toContain('sortField=age');
  });
});

describe('clearing', () => {
  it('removes the parameter entirely', async () => {
    const user = userEvent.setup();
    renderAt('/?search=kha');

    await user.click(screen.getByRole('button', { name: /clear search/i }));

    await waitFor(() => expect(params()).toBe(''), { timeout: SEARCH_DEBOUNCE_MS + 1000 });
  });
});

describe('URL → field', () => {
  it('restores the term from a deep link', () => {
    renderAt('/?search=kha');
    expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('kha');
  });

  it('follows Back, so the box never contradicts the results', async () => {
    const user = userEvent.setup();
    renderAt('/');

    await user.type(screen.getByRole('searchbox'), 'kha');
    await waitFor(() => expect(params()).toBe('?search=kha'), {
      timeout: SEARCH_DEBOUNCE_MS + 1000,
    });

    act(() => void window.history.back());

    await waitFor(() => expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe(''));
  });
});
