/**
 * HTTP handling for the users resource.
 *
 * The controller is the only layer that speaks HTTP. For each request it:
 *   1. parses and validates the request (`req.query`) into a typed `UsersQuery`,
 *   2. calls the service with plain values,
 *   3. shapes the HTTP response (status + JSON body).
 *
 * The router above it only maps URLs onto these methods; the service below it
 * never sees `req` or `res`. The service is injected, so tests can drive the
 * controller with a fake service and no database.
 *
 * Errors are not caught here on purpose: `parseUsersQuery` throws `HttpError`
 * and anything unexpected propagates. Express 5 forwards both — including
 * rejected promises from async handlers — to the error middleware, which owns
 * status codes and the error envelope.
 */

import type { RequestHandler } from 'express';
import type { UsersResponse } from '@presight/shared';

import type { UserService } from '../services';
import { parseUsersQuery } from './validators/users.query';

export interface UsersController {
  /** GET /api/users — 200 `UsersResponse`, 400 `ApiErrorBody` on invalid query. */
  list: RequestHandler;
}

export function createUsersController(userService: UserService): UsersController {
  return {
    list(req, res) {
      const query = parseUsersQuery(req.query);

      // Annotated rather than cast: if the service ever returns a shape that
      // drifts from the published contract, this line stops compiling.
      const payload: UsersResponse = userService.getUsers(query);

      res.status(200).json(payload);
    },
  };
}
