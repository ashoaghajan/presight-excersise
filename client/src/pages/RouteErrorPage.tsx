/**
 * Rendered by the router's `errorElement` when a route fails.
 *
 * Infrastructure, not product UI — kept minimal on purpose. `useRouteError`
 * returns `unknown`, so the shape is narrowed rather than assumed.
 */

import { isRouteErrorResponse, useRouteError } from 'react-router-dom';

import { ApiError } from '@/shared/api';

function describe(error: unknown): string {
  if (isRouteErrorResponse(error)) return `${error.status} ${error.statusText}`;
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Unknown error';
}

export function RouteErrorPage() {
  const error = useRouteError();

  return (
    <div role="alert" className="mx-auto max-w-md p-8 text-center">
      <h1 className="text-ink text-lg font-semibold">This page could not be loaded</h1>
      <p className="text-muted mt-2 text-sm">{describe(error)}</p>
    </div>
  );
}
