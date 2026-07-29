/**
 * Route table.
 *
 * A data router (`createBrowserRouter`) is used rather than `<BrowserRouter>`
 * because the whole view state — search text, selected hobbies and
 * nationalities, sort field and direction — lives in the query string, and the
 * data-router APIs (`useSearchParams`, `errorElement`) are the supported way to
 * read and update it while keeping back/forward navigation correct.
 *
 * There is only one screen today; the table exists so adding a user detail
 * route later does not require restructuring.
 *
 * Two error layers, deliberately distinct:
 *  - `errorElement` here catches *routing* failures (a bad route, a future
 *    loader throwing) and keeps the rest of the app mounted;
 *  - the `ErrorBoundary` in `AppProviders` catches render crashes anywhere,
 *    including inside the router itself.
 */

import { createBrowserRouter } from 'react-router-dom';

import { NotFoundPage } from '@/pages/NotFoundPage';
import { RouteErrorPage } from '@/pages/RouteErrorPage';
import { UserDirectoryPage } from '@/pages/UserDirectoryPage';

export const ROUTES = {
  directory: '/',
} as const;

export const router = createBrowserRouter([
  {
    path: ROUTES.directory,
    element: <UserDirectoryPage />,
    errorElement: <RouteErrorPage />,
  },
  {
    // Explicit catch-all rather than relying on the default 404, so a mistyped
    // deep link gets a real page with a way back instead of a router error.
    path: '*',
    element: <NotFoundPage />,
  },
]);
