/**
 * The typed binding between the URL and the users query.
 *
 * The URL is the single source of truth — there is no local mirror of these
 * values, so there is nothing to keep in sync and nothing that can drift.
 * Refresh, deep links and shared URLs all restore the same view for free,
 * because there is no other place the state could have been hiding.
 *
 * ## History semantics
 *
 * Back/forward only behaves sensibly if each update declares its intent, so
 * this hook exposes *intent-named* actions rather than one generic setter:
 *
 * | Action                         | History   | Why                              |
 * | ------------------------------ | --------- | -------------------------------- |
 * | `toggleHobby` / `toggleNationality` | push  | discrete; Back should untick it  |
 * | `setSort`                      | push      | discrete; Back should restore it  |
 * | `setSearch`                    | see below | continuous                        |
 * | `reset`                        | push      | Back should undo "clear all"      |
 *
 * `setSearch` coalesces: starting a search from empty pushes (so Back returns
 * to the unfiltered list), but editing an existing term replaces. Pushing on
 * every keystroke would bury the previous real state under one entry per
 * character, and Back would crawl backwards through half-typed words.
 */

import { useCallback, useMemo } from 'react';

import { useUrlState, type HistoryMode } from '@/shared/hooks';
import type { SortDirection, SortField } from '@presight/shared';

import {
  parseUsersQueryState,
  serializeUsersQueryState,
  toggleValue,
  type UsersQueryState,
} from '../model/users-query';

export interface UseUsersQueryStateResult {
  state: UsersQueryState;

  /** Sets the search term. Coalesces into one history entry while typing. */
  setSearch: (search: string) => void;
  /** Adds or removes a hobby (AND filter). */
  toggleHobby: (hobby: string) => void;
  /** Adds or removes a nationality (OR filter). */
  toggleNationality: (nationality: string) => void;
  /** Changes sort field and/or direction. */
  setSort: (sort: { field?: SortField; direction?: SortDirection }) => void;
  /** Clears every filter, the search term and the sort back to defaults. */
  reset: () => void;

  /** Escape hatch for multi-field updates; prefer the named actions above. */
  setState: (patch: Partial<UsersQueryState>, mode?: HistoryMode) => void;
}

const codec = {
  parse: parseUsersQueryState,
  serialize: serializeUsersQueryState,
};

export function useUsersQueryState(): UseUsersQueryStateResult {
  // `push` is the default because most interactions here are discrete; the one
  // continuous input (search) opts into `replace` explicitly.
  const { state, setState: setUrlState, reset: resetUrlState } = useUrlState(codec, 'push');

  const setState = useCallback(
    (patch: Partial<UsersQueryState>, mode: HistoryMode = 'push') => {
      setUrlState((current) => ({ ...current, ...patch }), mode);
    },
    [setUrlState],
  );

  const currentSearch = state.search;
  const setSearch = useCallback(
    (search: string) => {
      // The history mode has to be decided before the update, from the term
      // currently rendered. Opening a search (empty → text) and clearing it
      // (text → empty) are discrete acts worth a history entry; refining an
      // existing term is not, so it replaces.
      const isDiscrete = currentSearch === '' || search === '';
      setUrlState((current) => ({ ...current, search }), isDiscrete ? 'push' : 'replace');
    },
    [setUrlState, currentSearch],
  );

  const toggleHobby = useCallback(
    (hobby: string) => {
      setUrlState(
        (current) => ({ ...current, hobbies: toggleValue(current.hobbies, hobby) }),
        'push',
      );
    },
    [setUrlState],
  );

  const toggleNationality = useCallback(
    (nationality: string) => {
      setUrlState(
        (current) => ({
          ...current,
          nationalities: toggleValue(current.nationalities, nationality),
        }),
        'push',
      );
    },
    [setUrlState],
  );

  const setSort = useCallback(
    ({ field, direction }: { field?: SortField; direction?: SortDirection }) => {
      setUrlState(
        (current) => ({
          ...current,
          ...(field !== undefined ? { sortField: field } : {}),
          ...(direction !== undefined ? { sortDirection: direction } : {}),
        }),
        'push',
      );
    },
    [setUrlState],
  );

  const reset = useCallback(() => resetUrlState('push'), [resetUrlState]);

  return useMemo(
    () => ({ state, setSearch, toggleHobby, toggleNationality, setSort, reset, setState }),
    [state, setSearch, toggleHobby, toggleNationality, setSort, reset, setState],
  );
}
