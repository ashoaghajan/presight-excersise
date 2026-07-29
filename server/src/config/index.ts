/**
 * Configuration layer.
 *
 * Environment variables are read *once*, validated, and frozen into a typed
 * object. No other module may touch `process.env`; that keeps configuration
 * mistakes a start-up failure instead of a runtime surprise deep inside a
 * repository, and makes the whole app trivially testable with a fake config.
 */

import path from 'node:path';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  /**
   * Absolute or relative path to the SQLite file. Relative paths resolve against
   * the server package root so the same value works from the repo root, from
   * `server/`, and inside the container.
   */
  DATABASE_PATH: z.string().min(1).default('./data/app.sqlite'),
  /** Comma-separated list of origins allowed to call the API. */
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'silent']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast and loudly: a misconfigured process should never accept traffic.
  console.error('Invalid environment configuration:', z.flattenError(parsed.error).fieldErrors);
  process.exit(1);
}

const env = parsed.data;

/** Package root (`server/`), independent of the current working directory. */
const packageRoot = path.resolve(__dirname, '..', '..');

export const config = Object.freeze({
  env: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  port: env.PORT,
  logLevel: env.LOG_LEVEL,
  corsOrigins: env.CORS_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  db: {
    path: path.isAbsolute(env.DATABASE_PATH)
      ? env.DATABASE_PATH
      : path.resolve(packageRoot, env.DATABASE_PATH),
  },
});

export type AppConfig = typeof config;
