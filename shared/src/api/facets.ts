/**
 * Facet counts power the sidebar (top hobbies / top nationalities).
 *
 * Counts are always scoped to the *currently applied* text search and filters,
 * never to the global dataset — see `ARCHITECTURE.md` ("Facet counting") for
 * the reasoning behind computing them alongside the page query.
 */

export interface FacetCount {
  value: string;
  count: number;
}

/** The sidebar shows the top 20 of each facet. */
export const FACET_LIMIT = 20;
