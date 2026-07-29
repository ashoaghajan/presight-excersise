/**
 * Integration test: the sort controls wired to the real URL state hook.
 *
 * The unit tests prove `SortControls` reports the right values and
 * `useUsersQueryState` writes the right URL. This proves the *composition* —
 * that clicking the control actually moves the query string — which is where
 * a wiring mistake in the page would hide.
 *
 * Runs against jsdom's real History API, so back/forward are genuine.
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import { useUsersQueryState } from '@/features/users/hooks';

import { SortControls } from './SortControls';

/** Mirrors how `UserDirectoryPage` wires the control. */
function Harness() {
  const { state, setSort } = useUsersQueryState();

  return (
    <SortControls
      field={state.sortField}
      direction={state.sortDirection}
      onFieldChange={(field) => setSort({ field })}
      onDirectionChange={(direction) => setSort({ direction })}
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

describe('sort field → URL', () => {
  it('writes a non-default field', async () => {
    const user = userEvent.setup();
    renderAt('/');

    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort by' }), 'age');

    expect(params()).toBe('?sortField=age');
  });

  it('omits the field when it returns to the default', async () => {
    const user = userEvent.setup();
    renderAt('/?sortField=age');

    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort by' }), 'first_name');

    expect(params()).toBe('');
  });
});

describe('sort direction → URL', () => {
  it('writes desc when toggled from the default', async () => {
    const user = userEvent.setup();
    renderAt('/?sortField=age');

    await user.click(screen.getByRole('button'));

    expect(params()).toBe('?sortField=age&sortDirection=desc');
  });

  it('removes the parameter when toggled back to asc', async () => {
    const user = userEvent.setup();
    renderAt('/?sortField=age&sortDirection=desc');

    await user.click(screen.getByRole('button'));

    expect(params()).toBe('?sortField=age');
  });
});

describe('URL → controls', () => {
  it('restores both from a deep link', () => {
    renderAt('/?sortField=nationality&sortDirection=desc');

    expect((screen.getByRole('combobox', { name: 'Sort by' }) as HTMLSelectElement).value).toBe(
      'nationality',
    );
    expect(screen.getByText('Z–A')).toBeDefined();
  });

  it('ignores an unsupported field rather than breaking', () => {
    renderAt('/?sortField=salary');

    expect((screen.getByRole('combobox', { name: 'Sort by' }) as HTMLSelectElement).value).toBe(
      'first_name',
    );
  });
});

describe('other query parameters', () => {
  it('preserves search and filters when the sort changes', async () => {
    const user = userEvent.setup();
    renderAt('/?search=kha&hobbies=Reading&nationalities=India');

    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort by' }), 'age');

    expect(params()).toContain('search=kha');
    expect(params()).toContain('hobbies=Reading');
    expect(params()).toContain('nationalities=India');
    expect(params()).toContain('sortField=age');
  });
});

describe('history', () => {
  it('undoes a sort change on Back and reapplies it on Forward', async () => {
    const user = userEvent.setup();
    renderAt('/');

    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort by' }), 'age');
    expect(params()).toBe('?sortField=age');

    act(() => void window.history.back());
    await waitFor(() => expect(params()).toBe(''));

    act(() => void window.history.forward());
    await waitFor(() => expect(params()).toBe('?sortField=age'));
  });

  it('steps back through field and direction changes separately', async () => {
    const user = userEvent.setup();
    renderAt('/');

    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort by' }), 'age');
    await user.click(screen.getByRole('button'));
    expect(params()).toBe('?sortField=age&sortDirection=desc');

    act(() => void window.history.back());
    await waitFor(() => expect(params()).toBe('?sortField=age'));

    act(() => void window.history.back());
    await waitFor(() => expect(params()).toBe(''));
  });
});
