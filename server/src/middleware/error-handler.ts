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
import { HttpError, isHttpError } from '../lib/http-error';
import { logger } from '../lib/logger';

/**
 * `express.json()` (body-parser) throws its own errors, tagged with `type`.
 * They are the client's fault, so they map to 4xx — without this an oversized
 * or malformed body would be reported as a 500.
 */
function fromBodyParserError(err: unknown): HttpError | undefined {
  const type = typeof err === 'object' && err !== null ? (err as { type?: unknown }).type : null;
  if (type === 'entity.too.large') return HttpError.payloadTooLarge();
  if (type === 'entity.parse.failed') return HttpError.badRequest('Request body is not valid JSON');
  return undefined;
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const httpError = isHttpError(err) ? err : fromBodyParserError(err);

  if (httpError) {
    const body: ApiErrorBody = {
      error: { code: httpError.code, message: httpError.message, details: httpError.details },
    };
    res.status(httpError.status).json(body);
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
