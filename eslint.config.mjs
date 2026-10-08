import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores(['**/dist/**', '**/coverage/**']),

  js.configs.recommended,
  tseslint.configs.recommended,

  {
    files: ['server/**/*.ts', 'shared/**/*.ts', '*.{js,mjs}'],
    languageOptions: { globals: globals.node },
  },
  {
    // Playwright scripts: Node at the top level, browser inside page.evaluate().
    files: ['e2e/**/*.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    files: ['client/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    extends: [reactHooks.configs.flat.recommended],
  },
  {
    rules: {
      // Express error middleware needs 4 args; `_next` is unused by design.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
);
