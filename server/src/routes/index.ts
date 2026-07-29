/**
 * API router assembly — the single place where URL prefixes are decided.
 *
 * Everything is mounted under `/api` by `app.ts`, which keeps the namespace
 * free for a future static-file or SPA-fallback handler.
 */

import { Router } from 'express';

import { createHealthRouter } from './health.route';
import { createUsersRouter } from './users.route';
import type { UserService } from '../services';

export interface ApiRouterDeps {
  userService: UserService;
}

export function createApiRouter(deps: ApiRouterDeps): Router {
  const router = Router();

  router.use('/health', createHealthRouter());
  router.use('/users', createUsersRouter(deps.userService));

  return router;
}
