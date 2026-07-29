/**
 * Returns `value` after it has stopped changing for `delayMs`.
 *
 * Used for the search box: search is server-side, so without this every
 * keystroke is a request. Debouncing the *value* rather than the callback keeps
 * the input fully controlled — the field updates instantly while the query
 * lags behind, which is what makes typing feel responsive.
 */

import { useEffect, useState } from 'react';

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    // Each change restarts the timer; the cleanup cancels the previous one, so
    // only a pause longer than `delayMs` actually commits a value.
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
