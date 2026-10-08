/**
 * API router assembly — the single place where URL prefixes are decided.
 *
 * Everything is mounted under `/api` by `app.ts`, which keeps the namespace
 * free for a future static-file or SPA-fallback handler. Controllers are built
 * here from the injected services, so routers only ever receive a controller.
 */

import { Router } from 'express';

import { createUsersController } from '../controllers';
import type { UserService } from '../services';
import { createHealthRouter } from './health.route';
import { createUsersRouter } from './users.route';

export interface ApiRouterDeps {
  userService: UserService;
}

export function createApiRouter(deps: ApiRouterDeps): Router {
  const router = Router();

  router.use('/health', createHealthRouter());
  router.use('/users', createUsersRouter(createUsersController(deps.userService)));

  return router;
}
