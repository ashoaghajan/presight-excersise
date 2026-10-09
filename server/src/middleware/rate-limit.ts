/**
 * Per-IP rate limiting for the API.
 *
 * Mitigates brute force, scraping and single-client flooding: once a client
 * exceeds `max` requests inside `windowMs`, further requests get a 429 until
 * the window resets.
 *
 * - Over-limit requests are handed to the error middleware as an `HttpError`,
 *   so a 429 uses the same `{ error: { code, message } }` envelope as every
 *   other error. `Retry-After` and the `RateLimit-*` headers are set by the
 *   library before our handler runs.
 * - `/health` is exempt: docker compose polls it every 10s, and rate-limiting
 *   your own health check turns a busy minute into a "container unhealthy".
 * - The counter store is in memory, i.e. per process. That is correct for one
 *   server instance; several instances would need a shared store (Redis).
 * - The client IP comes from `req.ip`, which is only trustworthy because
 *   `trust proxy` is set to an exact hop count in `app.ts`.
 */

import type { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';

import { HttpError } from '../lib/http-error';

export interface RateLimitOptions {
  windowMs: number;
  max: number;
}

export function createRateLimiter({ windowMs, max }: RateLimitOptions): RequestHandler {
  return rateLimit({
    windowMs,
    limit: max,
    // `RateLimit` / `RateLimit-Policy` (IETF draft 8) instead of `X-RateLimit-*`.
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: (req) => req.path === '/health',
    handler: (_req, _res, next) => next(HttpError.tooManyRequests()),
  });
}
