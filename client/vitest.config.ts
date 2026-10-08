import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * Test configuration, kept separate from `vite.config.ts` so the dev/build
 * pipeline carries no test-only plugins or aliases.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // jsdom gives the hook tests a real History API, which is the whole point:
    // back/forward behaviour cannot be verified against a mock that does not
    // implement a history stack.
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      // `include` makes files no test imports show up as 0% instead of being
      // silently left out of the report.
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/main.tsx', 'src/vite-env.d.ts'],
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: 'coverage',
      // A ratchet a few points below today's numbers, not a target: it stops
      // coverage sliding backwards. Raise it as untested UI gains tests.
      thresholds: {
        lines: 65,
        statements: 63,
        functions: 58,
        branches: 62,
      },
    },
  },
});
