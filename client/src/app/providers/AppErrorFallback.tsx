/**
 * Last-resort fallback for an unrecoverable render error.
 *
 * Deliberately minimal and unstyled beyond the design tokens: this is
 * infrastructure, not product UI, and it has to keep working even when the
 * thing that broke is the styling or a shared component. The real error state
 * for *data* failures is a per-feature inline panel with a retry, not this.
 */

import { IS_DEV } from '@/shared/config/env';

export interface AppErrorFallbackProps {
  error: Error;
  onRetry: () => void;
}

export function AppErrorFallback({ error, onRetry }: AppErrorFallbackProps) {
  return (
    <div role="alert" className="mx-auto max-w-md p-8 text-center">
      <h1 className="text-ink text-lg font-semibold">Something went wrong</h1>
      <p className="text-muted mt-2 text-sm">The page failed to load. Retrying usually fixes it.</p>

      {/* The raw message is useful in development and noise in production. */}
      {IS_DEV && (
        <pre className="text-muted mt-4 overflow-x-auto rounded border border-subtle bg-surface p-3 text-left text-xs">
          {error.message}
        </pre>
      )}

      <button
        type="button"
        onClick={onRetry}
        className="bg-primary mt-6 rounded-lg px-4 py-2 text-sm font-medium text-white"
      >
        Try again
      </button>
    </div>
  );
}
