/**
 * Uniform error envelope.
 *
 * Every non-2xx response from the API uses this shape so the client has exactly
 * one error-parsing path (see `client/src/shared/api/http-client.ts`).
 */

export interface ApiErrorBody {
  error: {
    /** Stable, machine-readable code, e.g. `BAD_REQUEST`, `INTERNAL_ERROR`. */
    code: string;
    /** Human-readable message, safe to show in the UI. */
    message: string;
    /** Optional field-level validation details. */
    details?: unknown;
  };
}
