/**
 * Test fixture: a real, seeded, in-memory database plus an **independent
 * oracle**.
 *
 * The oracle is the point of this file. Comparing one SQL query against another
 * SQL query only re-confirms the same assumptions; comparing SQL against a
 * from-scratch reimplementation in plain JavaScript is what can actually catch
 * a semantic error. So `expectedUsers` below loads the three raw tables into
 * memory and recomputes every expected result with `Array.filter` / `Set` —
 * sharing no code, and no reasoning, with the repository layer.
 *
 * `:memory:` keeps each suite isolated and fast; the schema comes from the same
 * migrations production runs, and the rows from the same deterministic seeder,
 * so what is tested is the real thing rather than a hand-built fixture that
 * could drift from it.
 */

import Database from 'better-sqlite3';
import {
  FACET_LIMIT,
  type FacetCount,
  type SortDirection,
  type SortField,
  type UsersQuery,
} from '@presight/shared';

import { runMigrations } from '../db/migrator';
import { seedDatabase } from '../db/seed';
import type { Db } from '../db';
import { createFacetRepository, createUserRepository } from '../repositories';
import { createUserService } from '../services';
import type { UserService } from '../services';
import type { FacetRepository, UserRepository } from '../repositories';

/** A user as the oracle sees it: straight from the tables, nothing derived. */
export interface OracleUser {
  id: number;
  first_name: string;
  last_name: string;
  age: number;
  nationality: string;
  hobbies: string[];
}

export interface TestContext {
  db: Db;
  userRepository: UserRepository;
  facetRepository: FacetRepository;
  service: UserService;
  /** Every seeded user, for the oracle to filter. */
  oracle: OracleUser[];
  close: () => void;
}

/**
 * Smaller than the 1200-row production seed: large enough to produce real tie
 * groups, duplicate names and a facet list longer than 20, small enough that a
 * suite doing exhaustive walks stays fast.
 */
export const TEST_USER_COUNT = 300;
export const TEST_SEED = 4242;

export function createTestContext(
  { userCount = TEST_USER_COUNT, seed = TEST_SEED } = {} as {
    userCount?: number;
    seed?: number;
  },
): TestContext {
  const db = new Database(':memory:') as Db;
  db.pragma('foreign_keys = ON');

  runMigrations(db);
  seedDatabase(db, { userCount, seed, force: true });

  const userRepository = createUserRepository(db);
  const facetRepository = createFacetRepository(db);
  const service = createUserService({ userRepository, facetRepository });

  return {
    db,
    userRepository,
    facetRepository,
    service,
    oracle: loadOracle(db),
    close: () => db.close(),
  };
}

/** Reads the raw tables. Deliberately naive — this is the reference, not the code under test. */
function loadOracle(db: Db): OracleUser[] {
  const users = db
    .prepare<
      [],
      { id: number; first_name: string; last_name: string; age: number; nationality: string }
    >('SELECT id, first_name, last_name, age, nationality FROM users')
    .all();

  const links = db
    .prepare<
      [],
      { user_id: number; name: string }
    >('SELECT uh.user_id, h.name FROM user_hobbies uh JOIN hobbies h ON h.id = uh.hobby_id')
    .all();

  const byUser = new Map<number, string[]>();
  for (const link of links) {
    const list = byUser.get(link.user_id);
    if (list) list.push(link.name);
    else byUser.set(link.user_id, [link.name]);
  }

  return users.map((user) => ({ ...user, hobbies: byUser.get(user.id) ?? [] }));
}

/**
 * Mimics SQLite's `NOCASE` collation: fold ASCII `A-Z`, then compare code
 * units. Written out rather than using `localeCompare`, which applies locale
 * rules SQLite does not — that difference would show up as spurious ordering
 * failures on names with accents or punctuation.
 */
export function nocase(value: string): string {
  let folded = '';
  for (const char of value) {
    const code = char.charCodeAt(0);
    folded += code >= 65 && code <= 90 ? String.fromCharCode(code + 32) : char;
  }
  return folded;
}

function compareCodeUnits(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** The subset of a query the oracle needs. Everything is optional. */
export interface OracleQuery {
  search?: string;
  nationalities?: string[];
  hobbies?: string[];
}

/**
 * The reference implementation of the filter semantics:
 * search across both names, nationality **OR**, hobby **AND**, the three
 * combined with AND.
 */
export function expectedUsers(users: OracleUser[], query: OracleQuery = {}): OracleUser[] {
  const search = nocase((query.search ?? '').trim());
  const nationalities = (query.nationalities ?? []).map(nocase);
  const hobbies = (query.hobbies ?? []).map(nocase);

  return users.filter((user) => {
    if (search !== '') {
      const matches =
        nocase(user.first_name).includes(search) || nocase(user.last_name).includes(search);
      if (!matches) return false;
    }

    // OR: the user's single nationality must be one of the selected values.
    if (nationalities.length > 0 && !nationalities.includes(nocase(user.nationality))) {
      return false;
    }

    // AND: every selected hobby must be present on the user.
    if (hobbies.length > 0) {
      const owned = new Set(user.hobbies.map(nocase));
      if (!hobbies.every((hobby) => owned.has(hobby))) return false;
    }

    return true;
  });
}

/** Sorts by the given field with the mandatory `id ASC` tie-breaker. */
export function expectedOrder(
  users: OracleUser[],
  field: SortField,
  direction: SortDirection,
): OracleUser[] {
  const sign = direction === 'asc' ? 1 : -1;

  return [...users].sort((a, b) => {
    let primary: number;
    if (field === 'age') {
      primary = a.age - b.age;
    } else {
      primary = compareCodeUnits(nocase(a[field]), nocase(b[field]));
    }

    // The tie-breaker is ALWAYS ascending, even when the primary sort is
    // descending — reversing it too is the classic mistake, and it still looks
    // sorted while breaking pagination.
    return primary !== 0 ? primary * sign : a.id - b.id;
  });
}

/** Top-N facet counts, ordered `count DESC, value ASC` like the repository. */
export function expectedFacets(
  users: OracleUser[],
  kind: 'hobbies' | 'nationalities',
  limit = FACET_LIMIT,
): FacetCount[] {
  const counts = new Map<string, number>();

  for (const user of users) {
    const values = kind === 'hobbies' ? user.hobbies : [user.nationality];
    for (const value of values) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || compareCodeUnits(nocase(a.value), nocase(b.value)))
    .slice(0, limit);
}

/** Builds a full `UsersQuery` so tests only state what they care about. */
export function query(overrides: Partial<UsersQuery> = {}): UsersQuery {
  return {
    page: 1,
    limit: 50,
    search: '',
    hobbies: [],
    nationalities: [],
    sortField: 'first_name',
    sortDirection: 'asc',
    ...overrides,
  };
}
