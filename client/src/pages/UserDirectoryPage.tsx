/**
 * The one screen of the application.
 *
 * A page's job is composition and layout only — it wires feature components
 * together and owns nothing else. It holds the URL-synced query state and
 * passes the relevant slice down, which is what lets `filters` and `sorting`
 * stay presentational and avoids feature-to-feature imports.
 *
 * The four mutually exclusive result states live here rather than inside the
 * list, because choosing between them is a screen-level decision: skeletons on
 * first load, the error panel on failure *or* stall, the empty panel when the
 * filters match nothing, and otherwise the virtualized list.
 */

import { FilterDrawer, FilterSidebar } from '@/features/filters';
import { SortControls } from '@/features/sorting';
import {
  SearchField,
  UserListEmpty,
  UserListError,
  UserListSkeleton,
  VirtualUserList,
} from '@/features/users/components';
import { useUsersDirectory } from '@/features/users/hooks';
import { isDefaultQueryState } from '@/features/users/model/users-query';
import { useCloseFilterDrawer, useIsFilterDrawerOpen, useOpenFilterDrawer } from '@/shared/store';

export function UserDirectoryPage() {
  const { query, searchInput, data } = useUsersDirectory();

  const isDrawerOpen = useIsFilterDrawerOpen();
  const openDrawer = useOpenFilterDrawer();
  const closeDrawer = useCloseFilterDrawer();

  const selectedCount = query.state.hobbies.length + query.state.nationalities.length;

  // Any change to the query means a different result set, so the list should
  // start from the top again. Serialising the state is the cheapest way to say
  // "this is a different list" without comparing five fields by hand.
  const listResetKey = JSON.stringify(query.state);

  // One props object for both presentations, so the sidebar and the drawer
  // cannot fall out of step.
  const filterProps = {
    nationalities: data.nationalities,
    hobbies: data.hobbies,
    selectedNationalities: query.state.nationalities,
    selectedHobbies: query.state.hobbies,
    onToggleNationality: query.toggleNationality,
    onToggleHobby: query.toggleHobby,
    onClearAll: query.reset,
    // Only the *first* load shows skeletons. Re-filtering keeps the previous
    // facets on screen so the sidebar does not flash empty on every click.
    isLoading: data.isInitialLoading,
  };

  return (
    <div className="min-h-screen">
      {/* The search area sticks to the top while the list scrolls. */}
      <header className="border-subtle bg-surface/95 sticky top-0 z-30 min-h-[var(--header-height)] border-b backdrop-blur">
        {/* Wraps to three rows on mobile and sits on one on desktop. The
            controls are rendered *once* either way — duplicating them per
            breakpoint would also duplicate their live regions, and every sort
            change would be announced twice. */}
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 lg:flex-nowrap lg:gap-4 lg:px-6">
          <h1 className="text-ink shrink-0 text-[15px] font-semibold tracking-tight">
            User Directory
          </h1>

          {/* Mobile-only trigger; the sidebar is always visible on desktop. */}
          <button
            type="button"
            onClick={openDrawer}
            aria-expanded={isDrawerOpen}
            aria-haspopup="dialog"
            className="border-subtle text-ink hover:bg-canvas ml-auto flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors lg:hidden"
          >
            Filters
            {selectedCount > 0 && (
              <span className="bg-primary flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold text-white">
                {selectedCount}
              </span>
            )}
          </button>

          <SearchField
            value={searchInput.value}
            onChange={searchInput.setValue}
            isPending={searchInput.isPending}
            // `basis-full` (not just `w-full`) is what forces its own row on
            // mobile: a flex item can shrink below `w-full` and stay on the
            // line, which clipped the field. From `lg` it shares the row.
            className="order-10 basis-full lg:order-none lg:ml-2 lg:w-auto lg:max-w-md lg:flex-1 lg:basis-auto"
          />

          <SortControls
            field={query.state.sortField}
            direction={query.state.sortDirection}
            onFieldChange={(field) => query.setSort({ field })}
            onDirectionChange={(direction) => query.setSort({ direction })}
            className="order-20 lg:order-none lg:ml-auto"
          />
        </div>
      </header>

      <div className="flex items-start">
        <FilterSidebar {...filterProps} />

        {/* The sidebar takes its fixed 280px; the list takes the rest but is
            capped and centred inside it. Uncapped, a card on a wide monitor
            strands the age a hand's width from the nationality it belongs to;
            uncentred, the same cap leaves a lopsided empty band on the right. */}
        <main className="mx-auto min-w-0 w-full max-w-3xl flex-1 p-4 lg:p-6">
          {/* Live region: searching and filtering are not navigations, so
              without this a screen-reader user gets no feedback that the result
              set changed. */}
          <p aria-live="polite" className="text-muted mb-4 text-sm">
            {data.isInitialLoading
              ? 'Loading users…'
              : data.isError || data.isStalled
                ? 'Could not load users.'
                : `${data.total.toLocaleString()} ${data.total === 1 ? 'user' : 'users'}`}
          </p>

          {data.isInitialLoading ? (
            <UserListSkeleton />
          ) : data.isError || data.isStalled ? (
            <UserListError
              message={
                data.error?.message ??
                // A stalled query has no error object to quote, so it needs its
                // own message rather than a generic fallback.
                'The server could not be reached. Check that the API is running, then retry.'
              }
              onRetry={data.refetch}
            />
          ) : data.users.length === 0 ? (
            <UserListEmpty
              isUnfiltered={isDefaultQueryState(query.state)}
              selectedHobbyCount={query.state.hobbies.length}
              onClearFilters={query.reset}
            />
          ) : (
            <VirtualUserList
              users={data.users}
              hasNextPage={data.hasNextPage}
              isFetchingNextPage={data.isFetchingNextPage}
              fetchNextPage={data.fetchNextPage}
              // Scrolls back to the top whenever the result set changes.
              resetKey={listResetKey}
            />
          )}
        </main>
      </div>

      <FilterDrawer {...filterProps} isOpen={isDrawerOpen} onClose={closeDrawer} />
    </div>
  );
}
