import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Vite configuration.
 *
 * The dev server proxies `/api` to the Node server so the browser only ever
 * talks to one origin in development — no CORS preflights, and the same
 * relative URLs work unchanged in the Docker/nginx setup where nginx performs
 * the equivalent proxy.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // `import.meta.url` rather than `__dirname`: this package is ESM.
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    /**
     * `@presight/shared` emits CommonJS (one output format, deliberately — see
     * ARCHITECTURE §2.2). Vite skips dependency pre-bundling for *linked*
     * workspace packages by default, which means the dev server would serve
     * that CJS file straight to the browser as native ESM and every named
     * import from it would fail with "does not provide an export named …".
     *
     * Forcing it into pre-bundling converts CJS → ESM once, up front. The
     * production build does not need this (Rollup handles the interop), which
     * is exactly why the failure only ever appeared in `vite dev`.
     */
    include: ['@presight/shared'],
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    commonjsOptions: {
      // The linked workspace package lives outside `node_modules`, so it must
      // be opted in explicitly for the same CJS → ESM conversion at build time.
      include: [/shared/, /node_modules/],
    },
  },
});
