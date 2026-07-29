/**
 * A titled group of facet checkboxes.
 *
 * `<fieldset>` + `<legend>` is the correct grouping for related checkboxes: a
 * screen reader announces the group name with each control, so "Reading, 320
 * users, checkbox" is heard as part of "Hobbies" without the user having to
 * remember which list they are in. A `<div>` + heading would lose that.
 *
 * The list scrolls at a fixed max height rather than growing: twenty rows in
 * two groups would otherwise push the page well past a viewport and bury the
 * second group.
 */

import type { FacetCount } from '@presight/shared';

import { Skeleton } from '@/shared/ui';

import { isSelected } from '../model/filter-semantics';
import { FilterCheckbox } from './FilterCheckbox';

export interface FilterGroupProps {
  title: string;
  /** Short description of the group's match semantics (OR vs AND). */
  hint: string;
  facets: readonly FacetCount[];
  selected: readonly string[];
  onToggle: (value: string) => void;
  isLoading: boolean;
}

export function FilterGroup({
  title,
  hint,
  facets,
  selected,
  onToggle,
  isLoading,
}: FilterGroupProps) {
  return (
    <fieldset className="min-w-0 border-0 p-0">
      <legend className="mb-1 flex w-full items-baseline justify-between gap-2">
        <span className="text-ink text-sm font-semibold">{title}</span>
        {selected.length > 0 && (
          <span className="text-primary text-xs font-medium">{selected.length} selected</span>
        )}
      </legend>

      {/* The AND/OR difference is genuinely surprising — ticking a second hobby
          narrows rather than widens — so it is stated, not left to be inferred
          from counts going down. */}
      <p className="text-muted mb-2 text-xs">{hint}</p>

      {/* Capped and scrollable only from `lg`, where the sidebar is a fixed
          column and two 20-item lists would otherwise bury the second group.
          On mobile the drawer already scrolls, and nesting a second scroll
          area inside it makes flicking unpredictable — so the groups simply
          expand and the drawer handles the scrolling. */}
      <div className="scrollbar-slim -mx-2 overscroll-contain lg:max-h-[19rem] lg:overflow-y-auto">
        {isLoading ? (
          <FilterGroupSkeleton />
        ) : facets.length === 0 ? (
          <p className="text-muted px-2 py-2 text-sm">No options match the current filters.</p>
        ) : (
          <ul className="space-y-0.5">
            {facets.map((facet) => (
              <li key={facet.value}>
                <FilterCheckbox
                  value={facet.value}
                  count={facet.count}
                  checked={isSelected(selected, facet.value)}
                  onToggle={onToggle}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </fieldset>
  );
}

/**
 * Eight rows at the real row height. Loading must not shift the layout, so the
 * skeleton occupies a plausible slice of the final box rather than collapsing
 * to nothing.
 */
function FilterGroupSkeleton() {
  return (
    <div className="space-y-0.5 px-2 py-1">
      {Array.from({ length: 8 }, (_, index) => (
        <div key={index} className="flex items-center gap-3 py-2">
          <Skeleton className="h-[18px] w-[18px] rounded" />
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-3 w-6" />
        </div>
      ))}
    </div>
  );
}
