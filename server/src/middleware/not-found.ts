/**
 * Catch-all for unmatched routes. Registered after the API router and before
 * the error handler so unknown paths produce the same JSON error envelope as
 * everything else instead of Express's HTML default.
 */

import type { RequestHandler } from 'express';

import { HttpError } from '../lib/http-error';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(HttpError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};
