/**
 * Global client state.
 *
 * One store, deliberately small. See `ui-store.ts` for the rules on what may
 * and may not live here — the short version is that server data belongs to
 * TanStack Query and shareable view state belongs to the URL.
 */
export * from './ui-store';
