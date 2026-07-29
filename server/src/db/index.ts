/**
 * Database access layer — connection ownership only.
 *
 * `better-sqlite3` is used because it is synchronous: SQLite reads are served
 * from a local file in microseconds, so a thread-pool round trip buys nothing
 * and an async API would only add ceremony. One process-wide connection is
 * correct here — SQLite serialises writes internally and a single connection
 * lets every prepared statement be cached.
 *
 * Only `repositories/` may import this module. Services and routes must never
 * see a `Database` instance; that is what keeps SQL out of the upper layers.
 */

import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

import { config } from '../config';
import { logger } from '../lib/logger';
import { runMigrations } from './migrator';

export type Db = Database.Database;

let instance: Db | null = null;

/** Opens (and memoises) the shared connection, creating the data dir if needed. */
export function getDb(): Db {
  if (instance) return instance;

  fs.mkdirSync(path.dirname(config.db.path), { recursive: true });

  const db = new Database(config.db.path);

  // WAL lets readers run concurrently with the seeder/writer, which matters
  // while the client is scrolling and a migration or seed is in flight.
  db.pragma('journal_mode = WAL');
  // Foreign keys are OFF by default in SQLite; the user_hobbies join table
  // relies on them for referential integrity.
  db.pragma('foreign_keys = ON');
  // Wait rather than fail immediately if the seeder holds the write lock.
  db.pragma('busy_timeout = 5000');

  logger.info(`SQLite connection opened at ${config.db.path}`);
  instance = db;
  return instance;
}

/**
 * Opens the connection **and** brings the schema up to date.
 *
 * This is what the server calls at start-up: a process that would serve
 * requests against a stale or missing schema should never get as far as
 * listening. Migrations are idempotent, so this is safe on every boot and
 * makes a first run work with nothing more than `yarn start`.
 *
 * Seeding is deliberately NOT part of this — inserting demo rows is an
 * explicit operator action (`yarn db:seed`), not a side effect of booting.
 */
export function initializeDatabase(): Db {
  const db = getDb();
  runMigrations(db);
  return db;
}

/** Closes the shared connection. Used by CLI scripts and graceful shutdown. */
export function closeDb(): void {
  if (!instance) return;
  instance.close();
  instance = null;
}
