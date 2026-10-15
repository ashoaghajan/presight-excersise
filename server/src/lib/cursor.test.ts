/**
 * The cursor is untrusted input that comes back from the client, so the
 * decoder has to reject anything we did not issue rather than guess.
 */

import { describe, expect, it } from 'vitest';

import { decodeCursor, encodeCursor, type Cursor } from './cursor';

/** Builds a cursor string from an arbitrary payload, bypassing `encodeCursor`. */
function forge(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

describe('encodeCursor / decodeCursor', () => {
  it.each<Cursor>([
    { sortField: 'first_name', sortDirection: 'asc', position: { value: 'Ana', id: 1 } },
    { sortField: 'age', sortDirection: 'desc', position: { value: 42, id: 17 } },
    { sortField: 'nationality', sortDirection: 'asc', position: { value: 'Côte d’Ivoire', id: 9 } },
    { sortField: 'last_name', sortDirection: 'desc', position: { value: '', id: 3 } },
  ])('round-trips $sortField $sortDirection', (cursor) => {
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it('produces a URL-safe string', () => {
    const encoded = encodeCursor({
      sortField: 'first_name',
      sortDirection: 'asc',
      position: { value: '???>>>', id: 1 },
    });
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe('decodeCursor rejects', () => {
  it.each([
    ['empty string', ''],
    ['characters outside base64url', 'abc!!'],
    ['base64 that is not JSON', Buffer.from('not json').toString('base64url')],
    ['JSON that is not an object', forge(42)],
    ['unknown version', forge({ v: 2, f: 'age', d: 'asc', k: 1, id: 1 })],
    ['unknown sort field', forge({ v: 1, f: 'salary', d: 'asc', k: 1, id: 1 })],
    ['unknown direction', forge({ v: 1, f: 'age', d: 'up', k: 1, id: 1 })],
    ['text value for age', forge({ v: 1, f: 'age', d: 'asc', k: '42', id: 1 })],
    ['number value for a name', forge({ v: 1, f: 'first_name', d: 'asc', k: 42, id: 1 })],
    ['fractional age', forge({ v: 1, f: 'age', d: 'asc', k: 4.2, id: 1 })],
    ['non-positive id', forge({ v: 1, f: 'age', d: 'asc', k: 1, id: 0 })],
    ['missing id', forge({ v: 1, f: 'age', d: 'asc', k: 1 })],
    ['oversized text value', forge({ v: 1, f: 'first_name', d: 'asc', k: 'x'.repeat(201), id: 1 })],
  ])('%s', (_label, raw) => {
    expect(decodeCursor(raw)).toBeNull();
  });
});
