/**
 * Catch-all 404 for the router's `*` route.
 *
 * Deliberately minimal: the app has exactly one real screen, so this exists to
 * make a mistyped deep link recoverable rather than to be a destination.
 */

import { Link } from 'react-router-dom';

import { ROUTES } from '@/app/routes';

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-md p-8 text-center">
      <h1 className="text-ink text-lg font-semibold">Page not found</h1>
      <Link to={ROUTES.directory} className="text-primary mt-4 inline-block text-sm underline">
        Back to the directory
      </Link>
    </div>
  );
}
