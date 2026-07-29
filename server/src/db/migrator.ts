/**
 * Migration engine.
 *
 * Applies every `migrations/*.sql` file in filename order exactly once and
 * records it in `schema_migrations`. Plain SQL files were chosen over a
 * migration framework: the schema is small, and a reviewer can read the DDL
 * without learning a DSL.
 *
 * This module is deliberately free of process concerns (no argv, no exit
 * codes) so it can be called from three places: the `db:migrate` CLI, the
 * seeder (which must not run against a stale schema) and server start-up.
 */

import fs from 'node:fs';
import path from 'node:path';

import type { Db } from './index';
import { logger } from '../lib/logger';

/**
 * Resolved relative to this file so it works both under `tsx` (src/db/…) and
 * from the compiled output (dist/db/…). `tsc` does not copy `.sql` files, so
 * the server's `build` script mirrors the directory into `dist/`.
 */
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

/** Returns the migration filenames that have already been applied. */
function appliedMigrations(db: Db): Set<string> {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  return new Set(
    db
      .prepare<[], { name: string }>('SELECT name FROM schema_migrations')
      .all()
      .map((row) => row.name),
  );
}

/**
 * Brings the database up to date. Returns the migrations applied by this call,
 * which is empty when the schema was already current.
 */
export function runMigrations(db: Db): string[] {
  const applied = appliedMigrations(db);

  const pending = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .filter((file) => !applied.has(file));

  for (const file of pending) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');

    // Each migration is atomic: the DDL and its bookkeeping row commit together,
    // so a crash mid-migration can never leave the ledger lying about state.
    db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run(file);
    })();

    logger.info(`Applied migration ${file}`);
  }

  return pending;
}
