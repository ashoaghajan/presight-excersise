/**
 * User service — business logic and orchestration.
 *
 * Responsibilities:
 *  - decide *what* the endpoint means: one page of users AND the facet counts
 *    for the same filtered set, in a single consistent snapshot
 *  - derive `PaginationMeta` (totalPages / hasMore) from the repository's count
 *  - map persistence rows (`UserWithHobbies`) onto the wire contract (`UserDto`)
 *
 * It deliberately knows nothing about Express (no req/res) and nothing about
 * SQL. That is what makes it directly unit-testable with fake repositories.
 */

import {
  FACET_LIMIT,
  type PaginationMeta,
  type UserDto,
  type UsersQuery,
  type UsersResponse,
} from '@presight/shared';

import type { FacetRepository, UserRepository } from '../repositories';
import type { UserWithHobbies } from '../types/domain';

export interface UserService {
  /**
   * Returns the page of users plus the top hobbies/nationalities for the very
   * same query, so the sidebar can never disagree with the visible list.
   */
  getUsers(query: UsersQuery): UsersResponse;
}

export interface UserServiceDeps {
  userRepository: UserRepository;
  facetRepository: FacetRepository;
}

/**
 * Explicit row → DTO mapping rather than returning the row directly.
 *
 * The two shapes happen to be identical today, which is exactly when it is
 * tempting to skip this. Keeping it means adding an internal column later (a
 * soft-delete flag, an email, an audit timestamp) does not silently publish
 * itself to every client.
 */
function toUserDto(row: UserWithHobbies): UserDto {
  return {
    id: row.id,
    avatar: row.avatar,
    first_name: row.first_name,
    last_name: row.last_name,
    age: row.age,
    nationality: row.nationality,
    hobbies: row.hobbies,
  };
}

/**
 * Derives the pagination envelope.
 *
 * `hasMore` is computed from the total rather than from "did we get a full
 * page", because a page that happens to land exactly on the last row would
 * otherwise report `true` and the client would fetch an empty page before
 * stopping.
 */
function buildPaginationMeta(query: UsersQuery, total: number): PaginationMeta {
  return {
    page: query.page,
    limit: query.limit,
    total,
    totalPages: Math.ceil(total / query.limit),
    hasMore: query.page * query.limit < total,
  };
}

/** Dependencies are injected rather than imported: no hidden global wiring. */
export function createUserService(deps: UserServiceDeps): UserService {
  const { userRepository, facetRepository } = deps;

  return {
    getUsers(query: UsersQuery): UsersResponse {
      // All four calls receive the *same* query object and each rebuilds its
      // WHERE clause from the one shared filter builder, so the rows, the
      // total and both facet lists always describe the same set. better-sqlite3
      // is synchronous, so these run back-to-back on one connection with no
      // interleaving writer — the snapshot is consistent by construction.
      const total = userRepository.countUsers(query);
      const users = userRepository.searchUsers(query);
      const hobbies = facetRepository.getTopHobbies(query, FACET_LIMIT);
      const nationalities = facetRepository.getTopNationalities(query, FACET_LIMIT);

      return {
        users: users.map(toUserDto),
        pagination: buildPaginationMeta(query, total),
        hobbies,
        nationalities,
      };
    },
  };
}
