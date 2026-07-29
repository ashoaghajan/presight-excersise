import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { UserListEmpty, UserListError, UserListSkeleton } from './UserListStates';

describe('skeleton', () => {
  it('renders placeholder rows', () => {
    const { container } = render(<UserListSkeleton count={5} />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('is hidden from assistive tech, which should hear the live region instead', () => {
    const { container } = render(<UserListSkeleton />);
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('empty state', () => {
  it('offers a way out when filters are applied', async () => {
    const user = userEvent.setup();
    const onClearFilters = vi.fn();
    render(
      <UserListEmpty isUnfiltered={false} selectedHobbyCount={0} onClearFilters={onClearFilters} />,
    );

    expect(screen.getByRole('heading', { name: /no users found/i })).toBeDefined();

    await user.click(screen.getByRole('button', { name: /clear search and filters/i }));
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });

  it('explains the hobby AND rule once two or more hobbies are selected', () => {
    render(<UserListEmpty isUnfiltered={false} selectedHobbyCount={2} onClearFilters={vi.fn()} />);
    expect(screen.getByText(/must have every one of them/i)).toBeDefined();
  });

  it('does not mention the AND rule when it is not the cause', () => {
    // With only a search term applied, blaming hobby AND semantics would be
    // confusing rather than helpful.
    render(<UserListEmpty isUnfiltered={false} selectedHobbyCount={0} onClearFilters={vi.fn()} />);

    expect(screen.queryByText(/must have every one of them/i)).toBeNull();
    expect(screen.getByText(/try a shorter search term/i)).toBeDefined();
  });

  it('gives different advice when nothing is filtered', () => {
    // An empty directory with no filters is a data problem, not a search one.
    render(<UserListEmpty isUnfiltered selectedHobbyCount={0} onClearFilters={vi.fn()} />);

    expect(screen.getByText(/yarn db:seed/)).toBeDefined();
    expect(screen.queryByRole('button', { name: /clear search and filters/i })).toBeNull();
  });
});

describe('error state', () => {
  it('announces the failure', () => {
    render(<UserListError message="Network unreachable" onRetry={vi.fn()} />);

    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByText('Network unreachable')).toBeDefined();
  });

  it('offers a retry', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<UserListError message="Boom" onRetry={onRetry} />);

    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
