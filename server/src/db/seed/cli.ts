/**
 * Seed CLI: `yarn workspace presight-server db:seed [flags]`
 *   (or from the repo root: `yarn db:seed`)
 *
 * Flags:
 *   --force          re-seed even if the database already contains users
 *   --users=<n>      how many users to generate (default 1200, minimum 1)
 *   --seed=<n>       PRNG seed; the same seed reproduces the same data exactly
 *
 * Owns argv, logging and the exit code. All the actual work lives in
 * `./index.ts`.
 */

import { closeDb, getDb } from '../index';
import { DEFAULT_SEED, DEFAULT_USER_COUNT, seedDatabase } from './index';
import { logger } from '../../lib/logger';

/** Reads `--name=value` from argv, returning undefined when absent. */
function numberFlag(name: string, fallback: number): number {
  const prefix = `--${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);

  if (raw === undefined) return fallback;

  const value = Number(raw);
  if (!Number.isInteger(value)) {
    throw new Error(`--${name} must be an integer, received "${raw}"`);
  }
  return value;
}

try {
  const result = seedDatabase(getDb(), {
    userCount: numberFlag('users', DEFAULT_USER_COUNT),
    seed: numberFlag('seed', DEFAULT_SEED),
    force: process.argv.includes('--force'),
  });

  if (result.skipped) {
    logger.info(
      `Database already contains ${result.users} users — skipping. ` +
        'Pass --force to wipe and re-seed.',
    );
  }
} catch (error) {
  logger.error('Seeding failed', error);
  process.exitCode = 1;
} finally {
  closeDb();
}
