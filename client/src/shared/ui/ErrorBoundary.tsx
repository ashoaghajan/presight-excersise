/**
 * Render-error boundary.
 *
 * Hand-rolled as a class component because React still offers no hook
 * equivalent — `componentDidCatch` / `getDerivedStateFromError` are only
 * available on classes. A dependency (`react-error-boundary`) would add ~1 kB
 * and an upgrade surface for roughly this much code.
 *
 * Scope: this catches errors thrown while *rendering*. It does not catch
 * rejected promises from data fetching — TanStack Query surfaces those as an
 * `error` on the query result, which the feature renders as its own error
 * state. Both paths matter and neither replaces the other.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';

import { IS_DEV } from '@/shared/config/env';

export interface ErrorBoundaryProps {
  children: ReactNode;
  /**
   * Rendered instead of `children` after an error. Receives a `reset` callback
   * so the fallback can offer a retry that clears the error state.
   */
  fallback: (props: { error: Error; reset: () => void }) => ReactNode;
  /**
   * Changing any value in this array clears the error automatically. Pass the
   * things whose change should make a retry plausible — typically the route or
   * the active query key, so navigating away from a broken view recovers.
   */
  resetKeys?: readonly unknown[];
  /** Hook for error reporting (Sentry et al.). */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info);

    // In production this is where a reporting service would be called. Logging
    // in dev keeps the stack visible even though the fallback replaced the UI.
    if (IS_DEV) console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  override componentDidUpdate(previous: ErrorBoundaryProps): void {
    if (this.state.error === null) return;

    const previousKeys = previous.resetKeys ?? [];
    const currentKeys = this.props.resetKeys ?? [];

    const changed =
      previousKeys.length !== currentKeys.length ||
      previousKeys.some((key, index) => !Object.is(key, currentKeys[index]));

    if (changed) this.reset();
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    const { error } = this.state;
    if (error) return this.props.fallback({ error, reset: this.reset });
    return this.props.children;
  }
}
