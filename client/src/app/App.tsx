/**
 * Application shell: providers on the outside, router on the inside.
 *
 * `app/` is the composition layer of the frontend — the mirror image of the
 * server's composition root. It is the only place that knows about every other
 * layer; features and pages must never import from here.
 */

import { RouterProvider } from 'react-router-dom';

import { AppProviders } from './providers/AppProviders';
import { router } from './routes';

export function App() {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
