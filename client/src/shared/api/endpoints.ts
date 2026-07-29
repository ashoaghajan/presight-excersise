/**
 * Endpoint paths in one place, so a server-side route rename is a single-line
 * change on the client. Paths are relative: the Vite dev proxy and the nginx
 * container both forward `/api` to the Node server.
 */

export const API_ENDPOINTS = {
  users: '/users',
  health: '/health',
} as const;
