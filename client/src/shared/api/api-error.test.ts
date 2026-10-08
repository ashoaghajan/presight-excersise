/**
 * Tests for error normalisation.
 *
 * Every failure the UI renders passes through `toApiError`, so each branch is
 * driven with the shape Axios really produces for that failure: an error
 * envelope from our server, a non-JSON proxy page, a timeout, a cancellation
 * and a plain network failure.
 */

import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';
import { describe, expect, it } from 'vitest';
import type { ApiErrorBody } from '@presight/shared';

import { ApiError, CLIENT_ERROR_CODES, isCanceledError, toApiError } from './api-error';

function axiosErrorWithResponse(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() };
  const response: AxiosResponse = { status, statusText: '', data, headers: {}, config };
  return new AxiosError('Request failed', AxiosError.ERR_BAD_RESPONSE, config, {}, response);
}

describe('toApiError', () => {
  it('uses the code, message and details from the server error envelope', () => {
    const body: ApiErrorBody = {
      error: { code: 'BAD_REQUEST', message: 'Invalid query', details: { limit: ['too big'] } },
    };

    const error = toApiError(axiosErrorWithResponse(400, body));

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      code: 'BAD_REQUEST',
      message: 'Invalid query',
      details: { limit: ['too big'] },
    });
  });

  it('reports the status when the body is not our envelope (e.g. a proxy HTML page)', () => {
    const error = toApiError(axiosErrorWithResponse(502, '<html>Bad Gateway</html>'));

    expect(error).toMatchObject({
      status: 502,
      code: CLIENT_ERROR_CODES.unknown,
      message: 'Request failed with status 502',
    });
  });

  it('maps a timeout to status 0 / TIMEOUT', () => {
    const error = toApiError(new AxiosError('timeout', AxiosError.ECONNABORTED));

    expect(error).toMatchObject({ status: 0, code: CLIENT_ERROR_CODES.timeout });
  });

  it('maps a cancellation to CANCELED', () => {
    const error = toApiError(new AxiosError('canceled', AxiosError.ERR_CANCELED));

    expect(error.code).toBe(CLIENT_ERROR_CODES.canceled);
    expect(isCanceledError(error)).toBe(true);
  });

  it('maps a request with no response to NETWORK_ERROR', () => {
    const error = toApiError(new AxiosError('Network Error', AxiosError.ERR_NETWORK));

    expect(error).toMatchObject({ status: 0, code: CLIENT_ERROR_CODES.network });
  });

  it('wraps a non-Axios error, keeping its message', () => {
    expect(toApiError(new Error('boom'))).toMatchObject({
      status: 0,
      code: CLIENT_ERROR_CODES.unknown,
      message: 'boom',
    });
    expect(toApiError('weird').message).toBe('Something went wrong');
  });

  it('returns an existing ApiError unchanged', () => {
    const original = new ApiError(404, 'NOT_FOUND', 'Missing');

    expect(toApiError(original)).toBe(original);
  });
});

describe('ApiError classification', () => {
  it.each([
    [0, false, true],
    [400, true, false],
    [404, true, false],
    [500, false, true],
    [503, false, true],
  ])('status %i → isClientError=%s, isRetryable=%s', (status, isClientError, isRetryable) => {
    const error = new ApiError(status, 'X', 'x');

    expect(error.isClientError).toBe(isClientError);
    expect(error.isRetryable).toBe(isRetryable);
  });

  it('isCanceledError is false for other errors', () => {
    expect(isCanceledError(new ApiError(0, CLIENT_ERROR_CODES.network, 'x'))).toBe(false);
    expect(isCanceledError(new Error('x'))).toBe(false);
  });
});
