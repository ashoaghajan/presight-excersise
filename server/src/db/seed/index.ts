/**
 * Seeding logic.
 *
 * Free of process concerns (no argv, no `process.exit`) so it can be driven by
 * the `db:seed` CLI, by a test fixture, or by anything else that has a
 * connection. `cli.ts` owns the command-line surface.
 *
 * Two guarantees the exercise asks for explicitly:
 *
 * - **Repeatable.** All randomness comes from a seeded PRNG and the tables are
 *   truncated (including the AUTOINCREMENT counters) before inserting, so the
 *   same `--seed` always produces the same rows with the same ids. Running the
 *   command twice can never double the dataset.
 * - **Idempotent by default.** An already-populated database is left alone
 *   unless `--force` is passed, so restarting the server container is cheap.
 */

import type { Db } from '../index';
import { runMigrations } from '../migrator';
import { logger } from '../../lib/logger';
import {
  AGE_BANDS,
  AVATAR_BASE_URL,
  HOBBIES,
  HOBBY_COUNT_DISTRIBUTION,
  NATIONALITIES,
} from './data';
import { createRng } from './random';

/** Comfortably above the 1000-row minimum the plan requires. */
export const DEFAULT_USER_COUNT = 1200;

/** Any fixed value works; it just has to be stable across runs. */
export const DEFAULT_SEED = 20240517;

export interface SeedOptions {
  userCount?: number;
  /** PRNG seed. The same seed produces byte-identical data. */
  seed?: number;
  /** Re-seed even when the database already contains users. */
  force?: boolean;
}

export interface SeedResult {
  /** True when an existing dataset was left untouched. */
  skipped: boolean;
  users: number;
  hobbies: number;
  userHobbies: number;
}

/** Builds a stable avatar URL for a user. */
function avatarUrl(firstName: string, lastName: string, index: number): string {
  const seed = `${firstName}-${lastName}-${index}`;
  return `${AVATAR_BASE_URL}?seed=${encodeURIComponent(seed)}`;
}

/**
 * Truncates the seeded tables and resets their AUTOINCREMENT counters, so a
 * re-seed reproduces the same ids rather than continuing from the old high
 * water mark. Must run inside the caller's transaction.
 */
function clearExistingData(db: Db): void {
  db.exec('DELETE FROM user_hobbies');
  db.exec('DELETE FROM users');
  db.exec('DELETE FROM hobbies');

  // `sqlite_sequence` only exists once an AUTOINCREMENT table has been written
  // to, so its absence is normal on a freshly migrated database.
  const hasSequenceTable = db
    .prepare<
      [],
      { name: string }
    >("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'sqlite_sequence'")
    .get();

  if (hasSequenceTable) {
    db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('users', 'hobbies')").run();
  }
}

export function seedDatabase(db: Db, options: SeedOptions = {}): SeedResult {
  const userCount = options.userCount ?? DEFAULT_USER_COUNT;
  const seed = options.seed ?? DEFAULT_SEED;
  const force = options.force ?? false;

  if (userCount < 1) throw new Error('userCount must be at least 1');

  // Never seed against a schema that is behind: an outdated table definition
  // would fail deep inside the insert loop with a confusing error.
  runMigrations(db);

  const existingUsers = db
    .prepare<[], { count: number }>('SELECT COUNT(*) AS count FROM users')
    .get();

  if (!force && (existingUsers?.count ?? 0) > 0) {
    return { skipped: true, users: existingUsers?.count ?? 0, hobbies: 0, userHobbies: 0 };
  }

  const rng = createRng(seed);

  const insertHobby = db.prepare<[string]>('INSERT INTO hobbies (name) VALUES (?)');
  const insertUser = db.prepare<[string, string, string, number, string]>(
    'INSERT INTO users (avatar, first_name, last_name, age, nationality) VALUES (?, ?, ?, ?, ?)',
  );
  const insertUserHobby = db.prepare<[number, number]>(
    'INSERT INTO user_hobbies (user_id, hobby_id) VALUES (?, ?)',
  );

  // One transaction for the whole seed. better-sqlite3 commits per statement
  // otherwise, which turns ~5000 inserts into ~5000 fsyncs — seconds instead of
  // milliseconds.
  const run = db.transaction((): SeedResult => {
    clearExistingData(db);

    // Hobby catalogue first: users reference it by id.
    const hobbyIds = new Map<string, number>();
    for (const hobby of HOBBIES) {
      const info = insertHobby.run(hobby.value);
      hobbyIds.set(hobby.value, Number(info.lastInsertRowid));
    }

    let userHobbyCount = 0;

    for (let index = 0; index < userCount; index += 1) {
      const nationality = rng.weighted(
        NATIONALITIES.map((entry) => ({ value: entry, weight: entry.weight })),
      );

      const firstName = rng.pick(nationality.firstNames);
      const lastName = rng.pick(nationality.lastNames);
      const [minAge, maxAge] = rng.weighted(AGE_BANDS);

      const info = insertUser.run(
        avatarUrl(firstName, lastName, index),
        firstName,
        lastName,
        rng.int(minAge, maxAge),
        nationality.name,
      );
      const userId = Number(info.lastInsertRowid);

      // Weighted sampling *without replacement*: popular hobbies show up often,
      // but a user never gets the same hobby twice (which the composite primary
      // key on user_hobbies would reject anyway).
      const hobbyCount = rng.weighted(HOBBY_COUNT_DISTRIBUTION);
      for (const hobbyName of rng.weightedSample(HOBBIES, hobbyCount)) {
        const hobbyId = hobbyIds.get(hobbyName);
        if (hobbyId === undefined) continue;
        insertUserHobby.run(userId, hobbyId);
        userHobbyCount += 1;
      }
    }

    return {
      skipped: false,
      users: userCount,
      hobbies: HOBBIES.length,
      userHobbies: userHobbyCount,
    };
  });

  const result = run();

  // Refresh the planner's statistics so the first real query is not planned
  // against an empty-table estimate.
  db.exec('ANALYZE');

  logger.info(
    `Seeded ${result.users} users, ${result.hobbies} hobbies, ` +
      `${result.userHobbies} user-hobby links (seed=${seed})`,
  );

  return result;
}
