/**
 * Service layer: the pagination envelope and the single-snapshot guarantee.
 *
 * Uses fake repositories rather than a database — the point of the layering is
 * that this logic can be tested without one, and the boundary cases below
 * (`hasMore` at the exact end of the last page) are far easier to state with
 * hand-chosen totals.
 */

import { describe, expect, it, vi } from 'vitest';
import { FACET_LIMIT, type UsersQuery } from '@presight/shared';

import { createUserService } from './user.service';
import type { FacetRepository, UserRepository } from '../repositories';
import type { UserWithHobbies } from '../types/domain';
import { query } from '../test/fixture';

function fakeUser(id: number): UserWithHobbies {
  return {
    id,
    avatar: `https://example.test/${id}.svg`,
    first_name: `First${id}`,
    last_name: `Last${id}`,
    age: 30,
    nationality: 'Testland',
    hobbies: ['Reading'],
  };
}

function createService(total: number, rows: UserWithHobbies[] = []) {
  const userRepository: UserRepository = {
    searchUsers: vi.fn(() => rows),
    countUsers: vi.fn(() => total),
  };
  const facetRepository: FacetRepository = {
    getTopHobbies: vi.fn(() => [{ value: 'Reading', count: total }]),
    getTopNationalities: vi.fn(() => [{ value: 'Testland', count: total }]),
  };

  return {
    service: createUserService({ userRepository, facetRepository }),
    userRepository,
    facetRepository,
  };
}

describe('pagination metadata', () => {
  // `hasMore` is derived from the total rather than from "was the page full",
  // so a page landing exactly on the last row reports false instead of costing
  // the client an empty round trip. Stated as explicit expectations rather than
  // a formula, so a wrong formula cannot agree with itself.
  const cases: Array<{
    label: string;
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
    totalPages: number;
  }> = [
    { label: 'first of many', page: 1, limit: 10, total: 95, hasMore: true, totalPages: 10 },
    { label: 'second to last', page: 9, limit: 10, total: 95, hasMore: true, totalPages: 10 },
    {
      label: 'exact last (partial)',
      page: 10,
      limit: 10,
      total: 95,
      hasMore: false,
      totalPages: 10,
    },
    {
      label: 'exact last (full page)',
      page: 10,
      limit: 10,
      total: 100,
      hasMore: false,
      totalPages: 10,
    },
    { label: 'past the end', page: 11, limit: 10, total: 95, hasMore: false, totalPages: 10 },
    { label: 'limit of one', page: 3, limit: 1, total: 5, hasMore: true, totalPages: 5 },
    { label: 'empty result set', page: 1, limit: 10, total: 0, hasMore: false, totalPages: 0 },
  ];

  it.each(cases)('$label', ({ page, limit, total, hasMore, totalPages }) => {
    const { service } = createService(total);
    const result = service.getUsers(query({ page, limit }));

    expect(result.pagination).toEqual({ page, limit, total, totalPages, hasMore });
  });
});

describe('response assembly', () => {
  it('passes the identical query to all four repository calls', () => {
    // This is what guarantees the rows, the total and both facet lists describe
    // the same filtered set — the sidebar can never contradict the list.
    const { service, userRepository, facetRepository } = createService(3, [fakeUser(1)]);
    const q: UsersQuery = query({
      search: 'ann',
      hobbies: ['Reading'],
      nationalities: ['Testland'],
    });

    service.getUsers(q);

    expect(userRepository.countUsers).toHaveBeenCalledWith(q);
    expect(userRepository.searchUsers).toHaveBeenCalledWith(q);
    expect(facetRepository.getTopHobbies).toHaveBeenCalledWith(q, FACET_LIMIT);
    expect(facetRepository.getTopNationalities).toHaveBeenCalledWith(q, FACET_LIMIT);
  });

  it('maps rows onto the wire contract without leaking extra columns', () => {
    const row = { ...fakeUser(7), internal_note: 'should not ship' } as UserWithHobbies;
    const { service } = createService(1, [row]);

    const [user] = service.getUsers(query()).users;

    expect(Object.keys(user!).sort()).toEqual(
      ['age', 'avatar', 'first_name', 'hobbies', 'id', 'last_name', 'nationality'].sort(),
    );
  });
});
