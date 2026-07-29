import { defineConfig } from 'vitest/config';

/**
 * Server test configuration.
 *
 * `environment: 'node'` — these tests drive real SQLite and a real HTTP server;
 * there is no DOM in this workspace.
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
    restoreMocks: true,
  },
});
