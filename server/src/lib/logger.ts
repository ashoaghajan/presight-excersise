/**
 * Deliberately tiny console logger.
 *
 * A structured logger (pino/winston) would be the production choice, but the
 * exercise values simplicity — what matters architecturally is that the rest of
 * the code depends on *this* interface, so swapping the implementation later is
 * a one-file change.
 */

import { config } from '../config';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 } as const;

type Level = keyof typeof LEVELS;

const threshold = LEVELS[config.logLevel];

function log(level: Exclude<Level, 'silent'>, message: string, meta?: unknown): void {
  if (LEVELS[level] < threshold) return;
  const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${message}`;
  if (meta === undefined) console[level === 'debug' ? 'log' : level](line);
  else console[level === 'debug' ? 'log' : level](line, meta);
}

export const logger = {
  debug: (message: string, meta?: unknown) => log('debug', message, meta),
  info: (message: string, meta?: unknown) => log('info', message, meta),
  warn: (message: string, meta?: unknown) => log('warn', message, meta),
  error: (message: string, meta?: unknown) => log('error', message, meta),
};
