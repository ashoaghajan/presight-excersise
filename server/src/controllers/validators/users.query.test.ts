/**
 * The trust boundary.
 *
 * Policy under test: **absent means default, present-but-invalid means 400.**
 * The second half is the one worth protecting — silent coercion is how a shared
 * URL with a typo'd `sortField` ends up rendering different data than the
 * sender saw.
 */

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PAGE_SIZE,
  DEFAULT_SORT_DIRECTION,
  DEFAULT_SORT_FIELD,
  MAX_CURSOR_LENGTH,
  MAX_FILTER_VALUES,
  MAX_PAGE_SIZE,
  MAX_SEARCH_LENGTH,
} from '@presight/shared';

import { parseUsersQuery } from './users.query';
import { encodeCursor } from '../../lib/cursor';
import { isHttpError } from '../../lib/http-error';

const AGE_DESC_CURSOR = encodeCursor({
  sortField: 'age',
  sortDirection: 'desc',
  position: { value: 40, id: 12 },
});

/** Returns the thrown HttpError, failing the test if nothing was thrown. */
function rejects(params: unknown) {
  try {
    parseUsersQuery(params);
  } catch (error) {
    if (isHttpError(error)) return error;
    throw error;
  }
  throw new Error('expected parseUsersQuery to throw');
}

describe('defaults', () => {
  it('fills every field when nothing is supplied', () => {
    expect(parseUsersQuery({})).toEqual({
      after: null,
      limit: DEFAULT_PAGE_SIZE,
      search: '',
      hobbies: [],
      nationalities: [],
      sortField: DEFAULT_SORT_FIELD,
      sortDirection: DEFAULT_SORT_DIRECTION,
    });
  });

  it('ignores unknown query keys instead of rejecting them', () => {
    // Cache-busters and analytics tags are not the client's fault.
    expect(parseUsersQuery({ utm_source: 'email', _: '1730000000' }).limit).toBe(DEFAULT_PAGE_SIZE);
  });
});

describe('accepted input', () => {
  it('parses a full query', () => {
    expect(
      parseUsersQuery({
        cursor: AGE_DESC_CURSOR,
        limit: '25',
        search: '  ann  ',
        hobbies: ['Reading', 'Swimming'],
        nationalities: 'India',
        sortField: 'age',
        sortDirection: 'desc',
      }),
    ).toEqual({
      after: { value: 40, id: 12 },
      limit: 25,
      search: 'ann',
      hobbies: ['Reading', 'Swimming'],
      nationalities: ['India'],
      sortField: 'age',
      sortDirection: 'desc',
    });
  });

  it('accepts both repeated keys and comma-joined values', () => {
    expect(parseUsersQuery({ hobbies: 'Reading,Swimming' }).hobbies).toEqual([
      'Reading',
      'Swimming',
    ]);
    expect(parseUsersQuery({ hobbies: ['Reading', 'Swimming'] }).hobbies).toEqual([
      'Reading',
      'Swimming',
    ]);
  });

  it('de-duplicates filter values case-insensitively', () => {
    // Two entries for one hobby would break the AND filter, whose required
    // match count is the length of this array.
    expect(parseUsersQuery({ hobbies: ['Reading', 'reading', 'READING'] }).hobbies).toEqual([
      'Reading',
    ]);
  });

  it('drops blank filter values', () => {
    expect(parseUsersQuery({ hobbies: ['Reading', '', '   ', ','] }).hobbies).toEqual(['Reading']);
  });

  it('accepts the exact bounds', () => {
    expect(parseUsersQuery({ limit: String(MAX_PAGE_SIZE) }).limit).toBe(MAX_PAGE_SIZE);
    expect(parseUsersQuery({ search: 'x'.repeat(MAX_SEARCH_LENGTH) }).search.length).toBe(
      MAX_SEARCH_LENGTH,
    );
  });
});

describe('rejected input', () => {
  it.each([
    ['non-numeric limit', { limit: 'abc' }],
    ['fractional limit', { limit: '1.5' }],
    ['zero limit', { limit: '0' }],
    ['limit above the maximum', { limit: String(MAX_PAGE_SIZE + 1) }],
    ['unknown sort field', { sortField: 'salary' }],
    ['unknown sort direction', { sortDirection: 'sideways' }],
    ['over-long search', { search: 'x'.repeat(MAX_SEARCH_LENGTH + 1) }],
    [
      'too many filter values',
      { hobbies: Array.from({ length: MAX_FILTER_VALUES + 1 }, (_, i) => `h${i}`) },
    ],
  ])('rejects %s with a 400', (_label, params) => {
    const error = rejects(params);
    expect(error.status).toBe(400);
    expect(error.code).toBe('BAD_REQUEST');
  });

  it('reports every offending field at once', () => {
    // Three bad parameters should produce three field errors, not just the
    // first — otherwise fixing a URL becomes a guessing game.
    const error = rejects({ cursor: 'nope!', limit: '0', sortField: 'salary' });
    const details = error.details as Record<string, string[]>;

    expect(Object.keys(details).sort()).toEqual(['cursor', 'limit', 'sortField']);
  });

  it('names the accepted values for a bad sort field', () => {
    const details = rejects({ sortField: 'salary' }).details as Record<string, string[]>;
    expect(details.sortField?.[0]).toContain('first_name');
  });
});

describe('cursor', () => {
  it('decodes a cursor issued for the requested sort', () => {
    const parsed = parseUsersQuery({
      cursor: AGE_DESC_CURSOR,
      sortField: 'age',
      sortDirection: 'desc',
    });
    expect(parsed.after).toEqual({ value: 40, id: 12 });
  });

  it.each([
    ['garbage', 'not-a-cursor'],
    ['invalid characters', 'abc!!'],
    ['over-long', 'a'.repeat(MAX_CURSOR_LENGTH + 1)],
  ])('rejects a %s cursor with a 400 on the cursor field', (_label, cursor) => {
    const details = rejects({ cursor }).details as Record<string, string[]>;
    expect(Object.keys(details)).toEqual(['cursor']);
  });

  it('rejects a cursor issued for a different sort', () => {
    // A position under `age desc` means nothing under `first_name asc`.
    const error = rejects({ cursor: AGE_DESC_CURSOR, sortField: 'first_name' });
    expect(error.status).toBe(400);
    expect((error.details as Record<string, string[]>).cursor?.[0]).toContain('does not match');
  });

  it('rejects a cursor issued for the other direction of the same field', () => {
    expect(rejects({ cursor: AGE_DESC_CURSOR, sortField: 'age' }).status).toBe(400);
  });

  it('rejects the retired page parameter instead of silently ignoring it', () => {
    // An old client sending page=2 would otherwise get page 1 again and show
    // duplicates; a 400 makes the mismatch visible.
    const details = rejects({ page: '2' }).details as Record<string, string[]>;
    expect(details.page?.[0]).toContain('use cursor');
  });
});
