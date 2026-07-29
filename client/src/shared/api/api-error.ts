/**
 * The single error type the client deals with.
 *
 * Everything that can go wrong on a request — a 400 with field details, a
 * network failure, a timeout, an HTML error page from a misconfigured proxy —
 * is normalised into one shape here. Components and hooks then render error
 * states from a reliable `message` instead of type-sniffing an `unknown`.
 */

import { AxiosError } from 'axios';
import type { ApiErrorBody } from '@presight/shared';

/** Codes the client itself produces; server codes come from `ApiErrorBody`. */
export const CLIENT_ERROR_CODES = {
  network: 'NETWORK_ERROR',
  timeout: 'TIMEOUT',
  canceled: 'CANCELED',
  unknown: 'UNKNOWN_ERROR',
} as const;

export class ApiError extends Error {
  constructor(
    /** HTTP status, or 0 when the request never reached the server. */
    readonly status: number,
    readonly code: string,
    message: string,
    /** Field-level validation details when the server supplied them. */
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** 4xx: the request was wrong. Retrying it unchanged will not help. */
  get isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }

  /** Never reached the server, or the server failed — retrying may help. */
  get isRetryable(): boolean {
    return this.status === 0 || this.status >= 500;
  }
}

/** Type guard for the server's error envelope. */
function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = (value as { error?: unknown }).error;
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    typeof (candidate as { message?: unknown }).message === 'string'
  );
}

/**
 * Converts anything thrown by Axios into an `ApiError`.
 *
 * Kept as a plain function rather than inlined in the interceptor so it can be
 * unit-tested against the shapes Axios actually produces.
 */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (error instanceof AxiosError) {
    const { response, code } = error;

    // The server answered with our envelope — use its code and message.
    if (response && isApiErrorBody(response.data)) {
      return new ApiError(
        response.status,
        response.data.error.code,
        response.data.error.message,
        response.data.error.details,
      );
    }

    // The server answered, but not with JSON we recognise (proxy 502 page,
    // HTML error, empty body). Report the status rather than a parse failure.
    if (response) {
      return new ApiError(
        response.status,
        CLIENT_ERROR_CODES.unknown,
        `Request failed with status ${response.status}`,
      );
    }

    if (code === AxiosError.ECONNABORTED || code === AxiosError.ETIMEDOUT) {
      return new ApiError(0, CLIENT_ERROR_CODES.timeout, 'The request timed out. Please retry.');
    }

    if (code === AxiosError.ERR_CANCELED) {
      return new ApiError(0, CLIENT_ERROR_CODES.canceled, 'Request canceled');
    }

    return new ApiError(
      0,
      CLIENT_ERROR_CODES.network,
      'Could not reach the server. Check your connection and retry.',
    );
  }

  return new ApiError(
    0,
    CLIENT_ERROR_CODES.unknown,
    error instanceof Error ? error.message : 'Something went wrong',
  );
}

/** True when a request was aborted (filters changed mid-flight, unmount, …). */
export function isCanceledError(error: unknown): boolean {
  return error instanceof ApiError && error.code === CLIENT_ERROR_CODES.canceled;
}
