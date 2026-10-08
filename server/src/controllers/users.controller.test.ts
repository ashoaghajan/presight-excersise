/**
 * Unit tests for the users controller.
 *
 * The service is a fake, so these run without SQLite or an HTTP server and
 * check only the controller's own job: request in → typed query to the service
 * → response out. The real stack is covered end to end in
 * `routes/users.route.test.ts`.
 */

import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  DEFAULT_SORT_DIRECTION,
  DEFAULT_SORT_FIELD,
  type UsersResponse,
} from '@presight/shared';

import { HttpError } from '../lib/http-error';
import type { UserService } from '../services';
import { createUsersController } from './users.controller';

const RESPONSE: UsersResponse = {
  users: [],
  pagination: { page: 1, limit: 50, total: 0, totalPages: 0, hasMore: false },
  hobbies: [],
  nationalities: [],
};

function setup() {
  const userService = { getUsers: vi.fn<UserService['getUsers']>(() => RESPONSE) };
  const controller = createUsersController(userService);

  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };

  const list = (query: Record<string, unknown>) =>
    controller.list(
      { query } as unknown as Request,
      res as unknown as Response,
      vi.fn() as NextFunction,
    );

  return { userService, res, list };
}

describe('usersController.list', () => {
  it('passes a fully defaulted query to the service when none is given', () => {
    const { userService, list } = setup();

    list({});

    expect(userService.getUsers).toHaveBeenCalledWith({
      page: DEFAULT_PAGE,
      limit: DEFAULT_PAGE_SIZE,
      search: '',
      hobbies: [],
      nationalities: [],
      sortField: DEFAULT_SORT_FIELD,
      sortDirection: DEFAULT_SORT_DIRECTION,
    });
  });

  it('turns raw query-string values into typed values', () => {
    const { userService, list } = setup();

    list({ page: '2', limit: '10', search: '  ann ', hobbies: 'Chess,Golf', sortField: 'age' });

    expect(userService.getUsers).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        limit: 10,
        search: 'ann',
        hobbies: ['Chess', 'Golf'],
        sortField: 'age',
      }),
    );
  });

  it('responds 200 with exactly what the service returned', () => {
    const { res, list } = setup();

    list({});

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(RESPONSE);
  });

  it('throws a 400 HttpError for an invalid query and never calls the service', () => {
    const { userService, res, list } = setup();

    let thrown: unknown;
    try {
      list({ sortField: 'salary' });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpError);
    expect(thrown).toMatchObject({ status: 400, code: 'BAD_REQUEST' });
    expect(userService.getUsers).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('lets service errors propagate to the error middleware', () => {
    const { userService, list } = setup();
    userService.getUsers.mockImplementation(() => {
      throw new Error('database is locked');
    });

    expect(() => list({})).toThrow('database is locked');
  });
});
