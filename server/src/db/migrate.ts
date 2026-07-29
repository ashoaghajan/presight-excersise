/**
 * Migration CLI: `yarn workspace presight-server db:migrate [--fresh]`.
 *
 * Thin wrapper around `migrator.ts` — it owns argv, logging and the exit code,
 * and nothing else.
 *
 * `--fresh` deletes the database file first. Local development convenience;
 * it is the only supported way to pick up an edit to an already-applied
 * migration.
 */

import fs from 'node:fs';

import { closeDb, getDb } from './index';
import { runMigrations } from './migrator';
import { config } from '../config';
import { logger } from '../lib/logger';

function dropDatabaseFile(): void {
  if (!fs.existsSync(config.db.path)) return;

  fs.rmSync(config.db.path, { force: true });
  // WAL sidecar files must go too, otherwise SQLite reattaches stale pages.
  fs.rmSync(`${config.db.path}-wal`, { force: true });
  fs.rmSync(`${config.db.path}-shm`, { force: true });
  logger.warn(`Dropped existing database at ${config.db.path}`);
}

try {
  if (process.argv.includes('--fresh')) dropDatabaseFile();

  const applied = runMigrations(getDb());
  logger.info(
    applied.length > 0
      ? `Migrations up to date (${applied.length} applied)`
      : 'Migrations up to date (nothing to apply)',
  );
} catch (error) {
  logger.error('Migration failed', error);
  process.exitCode = 1;
} finally {
  closeDb();
}
