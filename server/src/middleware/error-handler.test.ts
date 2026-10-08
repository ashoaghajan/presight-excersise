/**
 * Unit tests for the terminal error middleware.
 *
 * The HTTP tests already cover the 400 path through the real app; what they
 * cannot reach is the *unexpected* error path, and that is the one with a
 * security property: in production an internal error message must never reach
 * the client. `config` is frozen at import time, so it is mocked with a
 * mutable flag to exercise both environments.
 */

import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiErrorBody } from '@presight/shared';

const env = vi.hoisted(() => ({ isProduction: false }));

vi.mock('../config', () => ({
  config: {
    get isProduction() {
      return env.isProduction;
    },
    logLevel: 'silent',
  },
}));

import { HttpError } from '../lib/http-error';
import { errorHandler } from './error-handler';

interface FakeResponse {
  statusCode: number;
  body: ApiErrorBody | undefined;
}

function invoke(err: unknown): FakeResponse {
  const captured: FakeResponse = { statusCode: 200, body: undefined };
  const res = {
    status(code: number) {
      captured.statusCode = code;
      return this;
    },
    json(body: ApiErrorBody) {
      captured.body = body;
      return this;
    },
  } as unknown as Response;

  errorHandler(err, {} as Request, res, vi.fn() as NextFunction);
  return captured;
}

describe('errorHandler', () => {
  beforeEach(() => {
    env.isProduction = false;
  });

  it('maps an HttpError onto its status and the error envelope', () => {
    const { statusCode, body } = invoke(
      HttpError.badRequest('Invalid query', { limit: ['too big'] }),
    );

    expect(statusCode).toBe(400);
    expect(body).toEqual({
      error: { code: 'BAD_REQUEST', message: 'Invalid query', details: { limit: ['too big'] } },
    });
  });

  it('turns an unexpected error into a 500 INTERNAL_ERROR', () => {
    const { statusCode, body } = invoke(new Error('SQLITE_BUSY: database is locked'));

    expect(statusCode).toBe(500);
    expect(body?.error.code).toBe('INTERNAL_ERROR');
  });

  it('shows the real message outside production for fast debugging', () => {
    const { body } = invoke(new Error('SQLITE_BUSY: database is locked'));

    expect(body?.error.message).toBe('SQLITE_BUSY: database is locked');
  });

  it('never leaks internal error details in production', () => {
    env.isProduction = true;

    const { body } = invoke(new Error('SQLITE_BUSY: database is locked'));

    expect(body?.error.message).toBe('Internal server error');
    expect(JSON.stringify(body)).not.toContain('SQLITE');
  });

  it('handles non-Error values that are thrown', () => {
    const { statusCode, body } = invoke('something odd');

    expect(statusCode).toBe(500);
    expect(body?.error.message).toBe('something odd');
  });
});
