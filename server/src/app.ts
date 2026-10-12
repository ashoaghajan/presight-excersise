/**
 * Express application assembly.
 *
 * Separated from `index.ts` on purpose: this module builds an app and returns
 * it, but never binds a port. That makes the whole HTTP surface testable with
 * supertest, and keeps process concerns (listening, signals, exit codes) in one
 * place.
 *
 * Middleware order is significant and encoded here:
 *   helmet -> cors -> json (size-limited) -> request log
 *     -> /api: rate limit -> API routes -> 404 -> error handler
 *
 * - helmet first, so every response — errors included — carries the headers.
 * - the body limit is enforced while parsing, before any handler sees the body.
 * - the rate limiter runs before the routes, so a rejected request costs almost
 *   nothing.
 */

import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';

import { config } from './config';
import { createRateLimiter, errorHandler, notFoundHandler, requestLogger } from './middleware';
import type { RateLimitOptions } from './middleware';
import { createApiRouter } from './routes';
import type { UserService } from './services';

export interface AppDeps {
  userService: UserService;
}

/** Security knobs, injectable so tests can use e.g. a tiny rate limit. */
export interface AppOptions {
  trustProxyHops: number;
  rateLimit: RateLimitOptions;
  jsonBodyLimit: string;
}

const defaultOptions: AppOptions = config.security;

export function createApp(deps: AppDeps, options: Partial<AppOptions> = {}): Express {
  const { trustProxyHops, rateLimit, jsonBodyLimit } = { ...defaultOptions, ...options };
  const app = express();

  // Behind nginx, trust exactly that many proxy hops so req.ip is the real
  // client. `true` would trust any X-Forwarded-For a client sends, letting it
  // spoof its IP and get a fresh rate-limit bucket on every request.
  app.set('trust proxy', trustProxyHops);
  // Query strings must support repeated keys (?hobbies=a&hobbies=b); Express 5
  // defaults to the "simple" parser, which drops the duplicates.
  app.set('query parser', 'extended');

  // Security headers (nosniff, frame protection, HSTS, CSP, referrer policy)
  // and removal of `X-Powered-By`.
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigins }));
  // Bodies over the limit are rejected with 413 before they are buffered in
  // full, so a huge payload cannot exhaust memory or block the event loop.
  app.use(express.json({ limit: jsonBodyLimit }));
  app.use(requestLogger);

  app.use('/api', createRateLimiter(rateLimit), createApiRouter({ userService: deps.userService }));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
