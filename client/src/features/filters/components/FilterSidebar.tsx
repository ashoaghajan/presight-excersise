/**
 * Desktop presentation: a persistent 280px column.
 *
 * `<aside>` gives it a complementary landmark, and the label lets screen-reader
 * users jump straight to it. It sticks below the sticky header so the filters
 * stay reachable while the user list scrolls.
 */

import { FilterPanel, type FilterPanelProps } from './FilterPanel';

export function FilterSidebar(props: FilterPanelProps) {
  return (
    <aside
      aria-label="Filters"
      className="w-sidebar border-subtle bg-surface scrollbar-slim sticky top-[var(--header-height)] hidden h-[calc(100vh-var(--header-height))] shrink-0 overflow-y-auto border-r px-6 py-6 lg:block"
    >
      <FilterPanel {...props} />
    </aside>
  );
}
