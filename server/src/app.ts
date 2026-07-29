/**
 * Express application assembly.
 *
 * Separated from `index.ts` on purpose: this module builds an app and returns
 * it, but never binds a port. That makes the whole HTTP surface testable with
 * supertest, and keeps process concerns (listening, signals, exit codes) in one
 * place.
 *
 * Middleware order is significant and encoded here:
 *   cors -> json -> request log -> API routes -> 404 -> error handler
 */

import cors from 'cors';
import express, { type Express } from 'express';

import { config } from './config';
import { errorHandler, notFoundHandler, requestLogger } from './middleware';
import { createApiRouter } from './routes';
import type { UserService } from './services';

export interface AppDeps {
  userService: UserService;
}

export function createApp(deps: AppDeps): Express {
  const app = express();

  // Behind nginx/compose, trust the proxy so req.ip and protocol are accurate.
  app.set('trust proxy', true);
  // Query strings must support repeated keys (?hobbies=a&hobbies=b); Express 5
  // defaults to the "simple" parser, which drops the duplicates.
  app.set('query parser', 'extended');

  app.use(cors({ origin: config.corsOrigins }));
  app.use(express.json());
  app.use(requestLogger);

  app.use('/api', createApiRouter({ userService: deps.userService }));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
