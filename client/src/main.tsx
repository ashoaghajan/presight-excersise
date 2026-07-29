/**
 * Browser entry point. Its only job is to mount `<App />`; every provider,
 * router and style import is resolved from `app/`, so this file should not need
 * to change again.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from '@/app/App';
import '@/styles/index.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Root container #root not found in index.html');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
