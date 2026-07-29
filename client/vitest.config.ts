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
  },
});
