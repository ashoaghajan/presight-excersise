/**
 * The filter content itself, independent of how it is presented.
 *
 * Desktop renders it inside a fixed 280px column; mobile renders the *same*
 * component inside a drawer. Sharing it is what stops the two layouts drifting
 * apart — a new filter group appears in both, or neither.
 *
 * Purely presentational: it receives facets and selections and reports changes
 * through callbacks. It never fetches, and it does not know the URL exists.
 * That is what keeps `filters` free of any dependency on the `users` feature
 * (see `features/README.md`).
 */

import type { FacetCount } from '@presight/shared';

import { FILTER_GROUP_COPY, withSelectedAlwaysVisible } from '../model/filter-semantics';
import { FilterGroup } from './FilterGroup';

export interface FilterPanelProps {
  nationalities: readonly FacetCount[];
  hobbies: readonly FacetCount[];
  selectedNationalities: readonly string[];
  selectedHobbies: readonly string[];
  onToggleNationality: (value: string) => void;
  onToggleHobby: (value: string) => void;
  onClearAll: () => void;
  isLoading: boolean;
  /**
   * The drawer supplies its own dialog header, so it suppresses this one to
   * avoid announcing "Filters" twice. Defaults to shown for the sidebar.
   */
  showHeading?: boolean;
}

export function FilterPanel({
  nationalities,
  hobbies,
  selectedNationalities,
  selectedHobbies,
  onToggleNationality,
  onToggleHobby,
  onClearAll,
  isLoading,
  showHeading = true,
}: FilterPanelProps) {
  const selectedCount = selectedNationalities.length + selectedHobbies.length;

  // Guarantees a selected value keeps a row even when it falls out of the
  // server's top 20 — otherwise it filters invisibly and cannot be removed.
  const nationalityFacets = withSelectedAlwaysVisible(nationalities, selectedNationalities);
  const hobbyFacets = withSelectedAlwaysVisible(hobbies, selectedHobbies);

  return (
    <div className="flex flex-col gap-6">
      {/* Rendered only when it has something in it. In the drawer the heading
          is suppressed, so with no filters applied this row would otherwise be
          ~48px of dead space above the first group. */}
      {(showHeading || selectedCount > 0) && (
        <div className="flex min-h-6 items-center justify-between gap-2">
          {showHeading && <h2 className="text-ink text-base font-semibold">Filters</h2>}

          {/* Pushed right when the heading is suppressed. */}
          {!showHeading && <span aria-hidden="true" />}

          {/* Only offered when it would do something — a permanently visible
            disabled button is noise. */}
          {selectedCount > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              className="text-primary rounded text-xs font-medium hover:underline"
            >
              Clear all
              {/* Announces what is being cleared, since "Clear all" alone is
                ambiguous out of context. */}
              <span className="sr-only"> filters, {selectedCount} currently applied</span>
            </button>
          )}
        </div>
      )}

      <FilterGroup
        title={FILTER_GROUP_COPY.nationalities.title}
        hint={FILTER_GROUP_COPY.nationalities.hint}
        facets={nationalityFacets}
        selected={selectedNationalities}
        onToggle={onToggleNationality}
        isLoading={isLoading}
      />

      <FilterGroup
        title={FILTER_GROUP_COPY.hobbies.title}
        hint={FILTER_GROUP_COPY.hobbies.hint}
        facets={hobbyFacets}
        selected={selectedHobbies}
        onToggle={onToggleHobby}
        isLoading={isLoading}
      />
    </div>
  );
}
