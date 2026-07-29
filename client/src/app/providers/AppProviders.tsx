/**
 * Single place where global providers are stacked.
 *
 * Keeping them here (instead of in `main.tsx`) means tests can render a page
 * wrapped in the exact same provider tree the app uses.
 *
 * Order matters: the error boundary is outermost so that a crash inside a
 * provider's own subtree still renders a fallback rather than a blank page.
 * `QueryErrorResetBoundary` sits between them so "Try again" in the fallback
 * also clears any query that errored — otherwise the boundary would re-render
 * children that immediately throw the cached failure again.
 */

import type { ReactNode } from 'react';
import { QueryClientProvider, QueryErrorResetBoundary } from '@tanstack/react-query';

import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';
import { AppErrorFallback } from './AppErrorFallback';
import { queryClient } from './query-client';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <QueryErrorResetBoundary>
        {({ reset }) => (
          <ErrorBoundary
            resetKeys={[]}
            fallback={({ error, reset: resetBoundary }) => (
              <AppErrorFallback
                error={error}
                onRetry={() => {
                  reset();
                  resetBoundary();
                }}
              />
            )}
          >
            {children}
          </ErrorBoundary>
        )}
      </QueryErrorResetBoundary>
    </QueryClientProvider>
  );
}
