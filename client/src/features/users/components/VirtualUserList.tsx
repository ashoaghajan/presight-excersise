/**
 * Virtualized, infinitely-scrolling list of user cards.
 *
 * ## Why window virtualization
 *
 * `useWindowVirtualizer` rather than a fixed-height scroll container: the page
 * scrolls naturally, which is what makes mobile behave (address-bar hiding,
 * overscroll, momentum) and lets the sticky header and sticky sidebar work. A
 * nested scroll area would trap the wheel and give the page two scrollbars.
 *
 * The cost is that the virtualizer must be told where the list starts in the
 * document — that is `scrollMargin`, read from the container's offset. Without
 * it, every item is positioned as if the list began at the top of the page and
 * the whole list renders shifted by the header's height.
 *
 * ## DOM size
 *
 * Only the visible window plus `VIRTUAL_OVERSCAN` rows above and below are ever
 * mounted, so the DOM holds ~20 cards regardless of whether the result set is
 * 50 or 50,000. `measureElement` re-measures each mounted card, so cards whose
 * hobby chips wrap to a second line are positioned correctly rather than
 * relying on the estimate.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import type { UserDto } from '@presight/shared';

import {
  INFINITE_SCROLL_THRESHOLD_ROWS,
  USER_CARD_ESTIMATED_HEIGHT,
  VIRTUAL_OVERSCAN,
} from '../model/list-config';
import { UserCard } from './UserCard';

export interface VirtualUserListProps {
  users: UserDto[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  /**
   * Changes whenever the search/filters/sort change. Used to reset the scroll
   * position — staying at 4000px after filtering down to three results leaves
   * the user staring at blank space.
   */
  resetKey: string;
}

export function VirtualUserList({
  users,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  resetKey,
}: VirtualUserListProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  /**
   * Offset of the list within the document, held in state rather than read from
   * the ref inline: the ref is null on first render, so an inline read would
   * leave `scrollMargin` at 0 with no re-render to correct it, and every card
   * would sit one header-height too high. Re-measured when the header can
   * change height (viewport resize) or when the query changes.
   */
  const [scrollMargin, setScrollMargin] = useState(0);

  useLayoutEffect(() => {
    const measure = () => setScrollMargin(containerRef.current?.offsetTop ?? 0);
    measure();

    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [resetKey]);

  const virtualizer = useWindowVirtualizer({
    count: users.length,
    estimateSize: () => USER_CARD_ESTIMATED_HEIGHT,
    overscan: VIRTUAL_OVERSCAN,
    scrollMargin,
    // Stable keys mean React reuses card instances across scroll frames instead
    // of remounting them (and re-downloading avatars).
    getItemKey: useCallback((index: number) => users[index]?.id ?? index, [users]),
  });

  const virtualItems = virtualizer.getVirtualItems();

  // Scroll back to the top of the list when the query changes. `useLayoutEffect`
  // so it happens before paint — with a plain effect the user sees one frame of
  // the new results scrolled to the old offset.
  const isFirstRender = useRef(true);
  useLayoutEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [resetKey]);

  // Infinite scroll: request the next page once the last rendered row is within
  // `INFINITE_SCROLL_THRESHOLD_ROWS` of the end, so the fetch usually finishes
  // before the user gets there.
  const lastItemIndex = virtualItems.at(-1)?.index ?? 0;
  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    if (lastItemIndex >= users.length - INFINITE_SCROLL_THRESHOLD_ROWS) {
      fetchNextPage();
    }
  }, [lastItemIndex, users.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div ref={containerRef}>
      {/* The spacer gives the page its true scroll height, so the scrollbar
          reflects the whole result set even though ~20 cards exist. */}
      <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualItems.map((virtualItem) => {
          const user = users[virtualItem.index];
          if (!user) return null;

          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              className="absolute top-0 left-0 w-full pb-4"
              style={{
                transform: `translateY(${virtualItem.start - virtualizer.options.scrollMargin}px)`,
              }}
            >
              <UserCard user={user} />
            </div>
          );
        })}
      </div>

      {/* Loading indicator at the bottom; no pagination buttons. */}
      {isFetchingNextPage && (
        <p className="text-muted py-6 text-center text-sm" role="status">
          Loading more users…
        </p>
      )}

      {!hasNextPage && users.length > 0 && (
        <p className="text-muted py-6 text-center text-sm">End of results</p>
      )}
    </div>
  );
}
