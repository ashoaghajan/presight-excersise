/**
 * Terminal error middleware.
 *
 * Every layer below simply throws; this is the one place that decides status
 * codes and response bodies, so the API can never emit two different error
 * shapes. Must be registered LAST, and must keep its four-argument signature —
 * Express identifies error middleware by arity.
 */

import type { ErrorRequestHandler } from 'express';
import type { ApiErrorBody } from '@presight/shared';

import { config } from '../config';
import { isHttpError } from '../lib/http-error';
import { logger } from '../lib/logger';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (isHttpError(err)) {
    const body: ApiErrorBody = {
      error: { code: err.code, message: err.message, details: err.details },
    };
    res.status(err.status).json(body);
    return;
  }

  logger.error('Unhandled error', err);

  const body: ApiErrorBody = {
    error: {
      code: 'INTERNAL_ERROR',
      // Never leak internals in production; keep them in dev for fast feedback.
      message: config.isProduction
        ? 'Internal server error'
        : err instanceof Error
          ? err.message
          : String(err),
    },
  };
  res.status(500).json(body);
};
