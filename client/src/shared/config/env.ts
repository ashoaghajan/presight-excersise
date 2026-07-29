/**
 * Typed access to build-time environment values.
 *
 * Mirrors the server's config module: `import.meta.env` is read here and
 * nowhere else, so there is one place to look when an environment value is
 * wrong or missing.
 */

/**
 * Defaults to the relative `/api` prefix, which works in dev (Vite proxy) and
 * in Docker (nginx proxy). Override with `VITE_API_BASE_URL` when the API is
 * hosted on a different origin.
 */
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? '/api';

/**
 * Request timeout. Generous relative to the measured server response (well
 * under 1 ms), but short enough that a hung proxy surfaces as an error state
 * the user can retry rather than an indefinite spinner.
 */
export const API_TIMEOUT_MS = 15_000;

/** True in `vite dev`; used to gate dev-only diagnostics. */
export const IS_DEV: boolean = import.meta.env.DEV;
