/**
 * Service layer: the pagination envelope and the single-snapshot guarantee.
 *
 * Uses fake repositories rather than a database — the point of the layering is
 * that this logic can be tested without one, and the boundary cases below
 * (`hasMore` at the exact end of the last page) are far easier to state with
 * hand-chosen rows.
 */

import { describe, expect, it, vi } from 'vitest';
import { FACET_LIMIT, type UsersQuery } from '@presight/shared';

import { decodeCursor } from '../lib/cursor';
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
  // The service asks the repository for `limit + 1` rows. The extra row is a
  // probe: if it exists there is a next page. These cases pin the boundaries
  // where a wrong comparison (>= vs >) would show up.
  const users = (count: number) => Array.from({ length: count }, (_, i) => fakeUser(i + 1));

  it('asks the repository for one row more than the page size', () => {
    const { service, userRepository } = createService(100, users(11));
    service.getUsers(query({ limit: 10 }));
    expect(userRepository.searchUsers).toHaveBeenCalledWith(expect.objectContaining({ limit: 11 }));
  });

  it.each([
    { label: 'probe row present', fetched: 11, returned: 10, hasMore: true },
    { label: 'exactly a full page', fetched: 10, returned: 10, hasMore: false },
    { label: 'partial last page', fetched: 4, returned: 4, hasMore: false },
    { label: 'empty result set', fetched: 0, returned: 0, hasMore: false },
  ])('$label', ({ fetched, returned, hasMore }) => {
    const { service } = createService(95, users(fetched));
    const result = service.getUsers(query({ limit: 10 }));

    expect(result.users).toHaveLength(returned);
    expect(result.pagination.hasMore).toBe(hasMore);
    expect(result.pagination.nextCursor !== null).toBe(hasMore);
    expect(result.pagination).toMatchObject({ limit: 10, total: 95 });
  });

  it('points the cursor at the last returned row, not at the probe row', () => {
    const rows = users(11).map((user, i) => ({ ...user, age: 20 + i }));
    const { service } = createService(100, rows);

    const { pagination } = service.getUsers(
      query({ limit: 10, sortField: 'age', sortDirection: 'desc' }),
    );

    expect(decodeCursor(pagination.nextCursor!)).toEqual({
      sortField: 'age',
      sortDirection: 'desc',
      position: { value: 29, id: 10 },
    });
  });

  it('stores the value of the active sort field in the cursor', () => {
    const { service } = createService(100, users(3));
    const { pagination } = service.getUsers(query({ limit: 2, sortField: 'last_name' }));

    expect(decodeCursor(pagination.nextCursor!)?.position).toEqual({ value: 'Last2', id: 2 });
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
    // Same filters and sort; only the limit grows by the probe row.
    expect(userRepository.searchUsers).toHaveBeenCalledWith({ ...q, limit: q.limit + 1 });
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
