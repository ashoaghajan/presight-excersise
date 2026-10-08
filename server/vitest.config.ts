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
    coverage: {
      provider: 'v8',
      // `include` makes files no test imports show up as 0% instead of being
      // silently left out of the report.
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/test/**',
        'src/types/**',
        // Process entry points: they only wire things together and exit, and
        // are exercised by the Docker build / e2e runs rather than unit tests.
        'src/index.ts',
        'src/db/migrate.ts',
        'src/db/seed/cli.ts',
      ],
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: 'coverage',
      // A ratchet set a few points below the current numbers: it stops
      // coverage sliding backwards without rewarding tests written for the
      // number. Raise it as coverage grows.
      thresholds: {
        lines: 85,
        statements: 85,
        functions: 85,
        branches: 75,
      },
    },
  },
});
