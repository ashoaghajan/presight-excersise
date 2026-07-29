/**
 * Minimal access log. Kept hand-rolled instead of pulling in morgan so the
 * output goes through the same `logger` (and therefore the same LOG_LEVEL) as
 * the rest of the application.
 */

import type { RequestHandler } from 'express';

import { logger } from '../lib/logger';

export const requestLogger: RequestHandler = (req, res, next) => {
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    logger.debug(`${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs.toFixed(1)}ms`);
  });

  next();
};
