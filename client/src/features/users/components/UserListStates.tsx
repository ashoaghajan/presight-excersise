/**
 * The three non-list states, kept together because they are alternatives to
 * each other and to the list itself.
 *
 * Skeletons avoid layout shift, the empty state explains itself, and the error
 * state offers a retry.
 */

import type { ReactNode } from 'react';

import { Skeleton } from '@/shared/ui';
import { USER_CARD_ESTIMATED_HEIGHT } from '../model/list-config';

/**
 * Initial-load placeholder.
 *
 * Mirrors the real card's box exactly (same height, same avatar circle, same
 * three text rows) so nothing moves when the data arrives — which is the whole
 * point of a skeleton rather than a spinner.
 */
export function UserListSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="space-y-4" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="border-subtle bg-surface rounded-xl border p-4"
          style={{ height: USER_CARD_ESTIMATED_HEIGHT - 16 }}
        >
          <div className="flex gap-4">
            <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="flex justify-between gap-3">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3 w-12" />
              </div>
              <Skeleton className="h-3 w-24" />
              <div className="flex gap-1.5 pt-2">
                <Skeleton className="h-5 w-16 rounded-md" />
                <Skeleton className="h-5 w-20 rounded-md" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function StatePanel({ children }: { children: ReactNode }) {
  return (
    <div className="border-subtle bg-surface rounded-xl border px-6 py-14 text-center sm:py-20">
      {children}
    </div>
  );
}

/**
 * Circular icon badge. A tinted disc reads as intentional where a bare emoji
 * reads as a placeholder, and it costs no asset.
 */
function StateIcon({ children, tone }: { children: ReactNode; tone: 'neutral' | 'danger' }) {
  return (
    <div
      aria-hidden="true"
      className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full text-xl ${
        tone === 'danger' ? 'bg-red-50' : 'bg-canvas'
      }`}
    >
      {children}
    </div>
  );
}

/** Shared primary button so the two panels cannot drift apart. */
function PrimaryButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-primary mt-6 inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium text-white transition-colors hover:bg-blue-700"
    >
      {children}
    </button>
  );
}

export interface UserListEmptyProps {
  /** True when nothing is filtered — changes the advice, not just the wording. */
  isUnfiltered: boolean;
  /**
   * How many hobbies are selected. The AND rule is the usual reason a search
   * comes back empty, but only once two or more are ticked — mentioning it when
   * the user has merely typed a name is confusing rather than helpful.
   */
  selectedHobbyCount: number;
  onClearFilters: () => void;
}

export function UserListEmpty({
  isUnfiltered,
  selectedHobbyCount,
  onClearFilters,
}: UserListEmptyProps) {
  return (
    <StatePanel>
      <StateIcon tone="neutral">🔍</StateIcon>
      <h2 className="text-ink mt-4 text-base font-semibold">No users found</h2>

      {isUnfiltered ? (
        // An empty directory with no filters applied is a data problem, not a
        // search problem — telling the user to "adjust filters" would be wrong.
        <p className="text-muted mx-auto mt-2 max-w-sm text-sm">
          The directory is empty. If this is a fresh install, seed the database with{' '}
          <code className="text-ink">yarn db:seed</code>.
        </p>
      ) : (
        <>
          <p className="text-muted mx-auto mt-2 max-w-sm text-sm leading-relaxed">
            {selectedHobbyCount >= 2
              ? 'No one matches this combination. Each hobby you add narrows the results further, since a user must have every one of them.'
              : 'Nobody matches the current search and filters. Try a shorter search term, or removing a filter.'}
          </p>
          <PrimaryButton onClick={onClearFilters}>Clear search and filters</PrimaryButton>
        </>
      )}
    </StatePanel>
  );
}

export interface UserListErrorProps {
  message: string;
  onRetry: () => void;
}

export function UserListError({ message, onRetry }: UserListErrorProps) {
  return (
    <StatePanel>
      {/* `role="alert"` so the failure is announced, not silently swapped in. */}
      <div role="alert">
        <StateIcon tone="danger">⚠️</StateIcon>
        <h2 className="text-ink mt-4 text-base font-semibold">Could not load users</h2>
        <p className="text-muted mx-auto mt-2 max-w-sm text-sm leading-relaxed">{message}</p>
      </div>

      <PrimaryButton onClick={onRetry}>Try again</PrimaryButton>
    </StatePanel>
  );
}
