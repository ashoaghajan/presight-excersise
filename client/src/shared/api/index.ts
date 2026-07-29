/**
 * Shared API layer.
 *
 * Layer contract: this is the only place that knows HTTP exists. Feature
 * `api/` modules import from here; feature `components/` never do.
 */
export * from './api-error';
export * from './endpoints';
export * from './http-client';
export * from './serialize-params';
