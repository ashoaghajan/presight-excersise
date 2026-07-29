/**
 * Tests for the URL codec.
 *
 * Pure functions, so these are plain assertions with no React involved — which
 * is exactly why the codec was kept free of hooks. The round-trip property is
 * the important one: it is what guarantees a copied URL restores the state that
 * produced it.
 */

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_USERS_QUERY_STATE,
  isDefaultQueryState,
  parseUsersQueryState,
  serializeUsersQueryState,
  toggleValue,
  type UsersQueryState,
} from './users-query';

const parse = (search: string) => parseUsersQueryState(new URLSearchParams(search));
const serialize = (state: UsersQueryState) => serializeUsersQueryState(state).toString();

const fullState: UsersQueryState = {
  search: 'kha',
  hobbies: ['Reading', 'Swimming'],
  nationalities: ['United Arab Emirates', 'India'],
  sortField: 'age',
  sortDirection: 'desc',
};

describe('parseUsersQueryState', () => {
  it('returns defaults for an empty query string', () => {
    expect(parse('')).toEqual(DEFAULT_USERS_QUERY_STATE);
  });

  it('reads every supported parameter', () => {
    const state = parse(
      'search=kha&hobbies=Reading&hobbies=Swimming&nationalities=India&sortField=age&sortDirection=desc',
    );

    expect(state).toEqual({
      search: 'kha',
      hobbies: ['Reading', 'Swimming'],
      nationalities: ['India'],
      sortField: 'age',
      sortDirection: 'desc',
    });
  });

  it('falls back to defaults for unknown sort values rather than throwing', () => {
    // A hand-edited or truncated link must still open the directory. (The
    // server rejects the same input with a 400 — see the note in the codec.)
    const state = parse('sortField=salary&sortDirection=sideways');

    expect(state.sortField).toBe(DEFAULT_USERS_QUERY_STATE.sortField);
    expect(state.sortDirection).toBe(DEFAULT_USERS_QUERY_STATE.sortDirection);
  });

  it('drops blank list entries and collapses case-duplicates', () => {
    // Duplicates matter beyond tidiness: the hobby AND-filter's required match
    // count is the array length, so a duplicate would return zero rows.
    expect(parse('hobbies=&hobbies=Reading&hobbies=reading&hobbies=+').hobbies).toEqual([
      'Reading',
    ]);
  });

  it('trims surrounding whitespace from the search term', () => {
    expect(parse('search=++kha++').search).toBe('kha');
  });

  it('ignores unrelated parameters', () => {
    expect(parse('utm_source=x&page=7')).toEqual(DEFAULT_USERS_QUERY_STATE);
  });
});

describe('serializeUsersQueryState', () => {
  it('omits defaults so the unfiltered view stays a clean URL', () => {
    expect(serialize(DEFAULT_USERS_QUERY_STATE)).toBe('');
  });

  it('emits repeated bare keys, not bracket syntax', () => {
    // The API reads repeated bare keys; `hobbies[]=` would silently not filter.
    expect(serialize(fullState)).toContain('hobbies=Reading&hobbies=Swimming');
  });

  it('percent-encodes values containing spaces', () => {
    expect(serialize(fullState)).toContain('nationalities=United+Arab+Emirates');
  });

  it('is deterministic for identical state', () => {
    expect(serialize(fullState)).toBe(serialize(fullState));
  });
});

describe('round trip', () => {
  it('restores the exact state a URL was produced from', () => {
    // This is the property that makes "copy URL, open in a new tab" work.
    expect(parse(serialize(fullState))).toEqual(fullState);
  });

  it.each<UsersQueryState>([
    DEFAULT_USERS_QUERY_STATE,
    { ...DEFAULT_USERS_QUERY_STATE, search: 'a b&c=d' },
    { ...DEFAULT_USERS_QUERY_STATE, hobbies: ['Board Games'] },
    { ...DEFAULT_USERS_QUERY_STATE, nationalities: ['United Kingdom'], sortField: 'last_name' },
    { ...DEFAULT_USERS_QUERY_STATE, sortDirection: 'desc' },
    fullState,
  ])('round-trips %j', (state) => {
    expect(parse(serialize(state))).toEqual(state);
  });
});

describe('toggleValue', () => {
  it('appends a missing value, preserving selection order', () => {
    expect(toggleValue(['a'], 'b')).toEqual(['a', 'b']);
  });

  it('removes a present value', () => {
    expect(toggleValue(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('removes case-insensitively, matching the API collation', () => {
    expect(toggleValue(['Reading'], 'reading')).toEqual([]);
  });

  it('does not mutate its input', () => {
    const original = ['a'];
    toggleValue(original, 'b');
    expect(original).toEqual(['a']);
  });
});

describe('isDefaultQueryState', () => {
  it('is true only when nothing is filtered', () => {
    expect(isDefaultQueryState(DEFAULT_USERS_QUERY_STATE)).toBe(true);
    expect(isDefaultQueryState(fullState)).toBe(false);
  });

  it('ignores sort, which does not narrow the result set', () => {
    // Sorting is not filtering: an empty-state message should say "no users
    // match your filters" only when a filter is actually applied.
    expect(isDefaultQueryState({ ...DEFAULT_USERS_QUERY_STATE, sortDirection: 'desc' })).toBe(true);
  });
});
