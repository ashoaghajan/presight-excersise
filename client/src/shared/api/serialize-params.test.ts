/**
 * Tests for query-string serialisation.
 *
 * This is the client half of the API contract: the server's validator reads
 * repeated bare keys, so a regression here would silently drop filters rather
 * than fail loudly.
 */

import { describe, expect, it } from 'vitest';

import { serializeParams } from './serialize-params';

describe('serializeParams', () => {
  it('emits arrays as repeated bare keys, not `key[]=`', () => {
    expect(serializeParams({ hobbies: ['Chess', 'Golf'] })).toBe('hobbies=Chess&hobbies=Golf');
  });

  it('drops undefined, null and empty-string values', () => {
    expect(
      serializeParams({ page: 1, search: '', sortField: undefined, sortDirection: null }),
    ).toBe('page=1');
  });

  it('drops empty entries inside arrays', () => {
    expect(serializeParams({ nationalities: ['', 'German', null, undefined] })).toBe(
      'nationalities=German',
    );
  });

  it('omits an empty array entirely', () => {
    expect(serializeParams({ page: 1, hobbies: [] })).toBe('page=1');
  });

  it('percent-encodes values so `&` and spaces cannot break the query', () => {
    const query = serializeParams({ search: 'Tom & Jerry' });

    expect(query).toBe('search=Tom+%26+Jerry');
    expect(new URLSearchParams(query).get('search')).toBe('Tom & Jerry');
  });

  it('stringifies numbers and booleans', () => {
    expect(serializeParams({ page: 2, limit: 50, flag: false })).toBe('page=2&limit=50&flag=false');
  });
});
