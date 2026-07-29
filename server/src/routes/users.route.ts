/**
 * HTTP contract for `/api/users`.
 *
 * The route layer is intentionally thin — it only:
 *   1. validates the query string into a `UsersQuery`,
 *   2. calls the service,
 *   3. serialises the result as JSON.
 *
 * No SQL, no business rules. If a handler here grows past a few lines, the
 * logic belongs in the service.
 *
 * Errors are not caught here on purpose: `parseUsersQuery` throws `HttpError`
 * and anything unexpected propagates. Express 5 forwards both to the error
 * middleware, which owns status codes and the response envelope — so there is
 * exactly one place that decides what an error looks like on the wire.
 */

import { Router } from 'express';
import type { UsersResponse } from '@presight/shared';

import type { UserService } from '../services';
import { parseUsersQuery } from './validators/users.query';

export function createUsersRouter(userService: UserService): Router {
  const router = Router();

  /**
   * GET /api/users
   *
   * Query: page, limit, search, nationalities, hobbies, sortField, sortDirection
   * 200 → UsersResponse
   * 400 → ApiErrorBody with per-field validation details
   */
  router.get('/', (req, res) => {
    const query = parseUsersQuery(req.query);

    // Annotated rather than cast: if the service ever returns a shape that
    // drifts from the published contract, this line stops compiling.
    const payload: UsersResponse = userService.getUsers(query);

    res.json(payload);
  });

  return router;
}
