/**
 * Filter vocabulary and the one non-obvious rule the sidebar has to enforce.
 *
 * ## Semantics
 *
 * - **Nationalities — OR.** "UAE + UK" matches users from either. A user row
 *   holds exactly one nationality, so the selected values are alternatives.
 * - **Hobbies — AND.** "Reading + Swimming" matches only users who have both.
 *   Ticking a second hobby therefore *narrows* the result set, which is the
 *   opposite of what most filter UIs do — so the panel says so in the caption
 *   rather than leaving the user to infer it from shrinking counts.
 *
 * Both are enforced server-side; the client only has to describe them honestly.
 */

import type { FacetCount } from '@presight/shared';

export type FilterKind = 'hobbies' | 'nationalities';

/** Copy for each group, kept beside the semantics it describes. */
export const FILTER_GROUP_COPY: Record<FilterKind, { title: string; hint: string }> = {
  nationalities: {
    title: 'Nationality',
    hint: 'Matches any selected',
  },
  hobbies: {
    title: 'Hobbies',
    hint: 'Matches all selected',
  },
};

/** Case-insensitive membership, matching the API's NOCASE collation. */
export function isSelected(selected: readonly string[], value: string): boolean {
  const key = value.toLowerCase();
  return selected.some((entry) => entry.toLowerCase() === key);
}

/**
 * Guarantees every selected value has a visible, untickable row.
 *
 * The server returns the top 20 facets **for the current result set**, and a
 * selected value is not always in it. Concretely: select nationalities
 * `India + Japan`, then tick hobby `Falconry`; if no Japanese user has that
 * hobby, the nationality facets come back as `[India]` only. Japan is still in
 * the URL and still filtering, but its checkbox has vanished — the user cannot
 * untick it and the list looks broken.
 *
 * So any selected value missing from the facets is appended with `count: 0`.
 * Zero is accurate, not a placeholder: no user in the current result set has
 * that value.
 *
 * Selected values are ordered first so they never scroll out of view in a
 * 20-item list; the rest keep the server's `count DESC, value ASC` ordering.
 */
export function withSelectedAlwaysVisible(
  facets: readonly FacetCount[],
  selected: readonly string[],
): FacetCount[] {
  if (selected.length === 0) return [...facets];

  const present = new Set(facets.map((facet) => facet.value.toLowerCase()));

  const missing: FacetCount[] = selected
    .filter((value) => !present.has(value.toLowerCase()))
    .map((value) => ({ value, count: 0 }));

  const selectedFacets = facets.filter((facet) => isSelected(selected, facet.value));
  const unselectedFacets = facets.filter((facet) => !isSelected(selected, facet.value));

  return [...selectedFacets, ...missing, ...unselectedFacets];
}

/** Screen-reader label: "Reading, 320 users" beats "Reading 320". */
export function facetAccessibleLabel(value: string, count: number): string {
  return `${value}, ${count} ${count === 1 ? 'user' : 'users'}`;
}
