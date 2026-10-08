/**
 * Route table for `/api/users`.
 *
 * Only maps HTTP method + path onto controller methods. Parsing, calling the
 * service and shaping the response all live in the controller, so this file
 * reads as a list of endpoints and nothing else.
 */

import { Router } from 'express';

import type { UsersController } from '../controllers';

export function createUsersRouter(controller: UsersController): Router {
  const router = Router();

  router.get('/', controller.list);

  return router;
}
