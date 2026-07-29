/**
 * Public surface of `@presight/shared`.
 *
 * This package is the single source of truth for the HTTP contract between the
 * React client and the Node server. It intentionally contains **no** business
 * logic and **no** environment-specific code: only types, literal unions and
 * small constant tables that both sides must agree on.
 *
 * Rule of thumb: if changing a value would break the other side of the wire,
 * it belongs here. Everything else stays inside its own workspace.
 */
export * from './sorting';
export * from './api/facets';
export * from './api/pagination';
export * from './api/errors';
export * from './api/users';
