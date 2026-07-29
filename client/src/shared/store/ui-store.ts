/**
 * Global UI store (Zustand).
 *
 * ## What belongs here
 *
 * Ephemeral, cross-cutting *interface* state — things that are neither server
 * data nor part of the shareable view. Right now: whether the mobile filter
 * drawer is open.
 *
 * ## What must never go here
 *
 * - **Server data** (users, facet counts, totals). That is TanStack Query's
 *   job; copying it into a store means two caches to invalidate and a
 *   guaranteed source of stale UI.
 * - **The query state** (search text, selected hobbies/nationalities, sort
 *   field and direction). That lives in the URL — see
 *   `features/users/model/users-query.ts`. Mirroring it here would create two
 *   sources of truth for the same value, and the URL would lose every race.
 *
 * The rule of thumb: if a value should survive a page reload or appear in a
 * shared link, it goes in the URL. If a component tree needs it and it dies
 * with the session, it goes here. If it came from the API, it stays in Query.
 *
 * Zustand rather than Context for this: the drawer flag changes on every
 * toggle, and a Context value re-renders every consumer in its subtree.
 * Zustand's selector subscriptions mean only components reading the specific
 * slice re-render, which matters when a virtualized list of hundreds of rows
 * sits inside the same tree.
 */

import { create } from 'zustand';

export interface UiState {
  /** Mobile only: the filter drawer/sheet. */
  isFilterDrawerOpen: boolean;
  openFilterDrawer: () => void;
  closeFilterDrawer: () => void;
  toggleFilterDrawer: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  isFilterDrawerOpen: false,
  openFilterDrawer: () => set({ isFilterDrawerOpen: true }),
  closeFilterDrawer: () => set({ isFilterDrawerOpen: false }),
  toggleFilterDrawer: () => set((state) => ({ isFilterDrawerOpen: !state.isFilterDrawerOpen })),
}));

/**
 * Selector hooks.
 *
 * Components should read through these rather than calling `useUiStore()` bare:
 * subscribing to the whole store re-renders on every unrelated change, which
 * defeats the reason Zustand was chosen. Actions are stable identities, so
 * selecting them never causes a re-render.
 */
export const useIsFilterDrawerOpen = (): boolean => useUiStore((state) => state.isFilterDrawerOpen);
export const useOpenFilterDrawer = (): (() => void) =>
  useUiStore((state) => state.openFilterDrawer);
export const useCloseFilterDrawer = (): (() => void) =>
  useUiStore((state) => state.closeFilterDrawer);
export const useToggleFilterDrawer = (): (() => void) =>
  useUiStore((state) => state.toggleFilterDrawer);
