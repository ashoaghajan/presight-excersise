/**
 * The one error type layers below the routes are allowed to throw when they
 * want to influence the HTTP status code. Anything else that escapes is treated
 * as an unexpected 500 by the error-handling middleware.
 */

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }

  static badRequest(message: string, details?: unknown): HttpError {
    return new HttpError(400, 'BAD_REQUEST', message, details);
  }

  static notFound(message = 'Resource not found'): HttpError {
    return new HttpError(404, 'NOT_FOUND', message);
  }

  static payloadTooLarge(message = 'Request body is too large'): HttpError {
    return new HttpError(413, 'PAYLOAD_TOO_LARGE', message);
  }

  static tooManyRequests(message = 'Too many requests, please retry later'): HttpError {
    return new HttpError(429, 'RATE_LIMITED', message);
  }

  static internal(message = 'Internal server error'): HttpError {
    return new HttpError(500, 'INTERNAL_ERROR', message);
  }
}

export function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError;
}
