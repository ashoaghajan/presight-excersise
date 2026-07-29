/**
 * Binds a text input to the URL-synced search term.
 *
 * ## Why this hook exists
 *
 * Binding the input's `value` straight to the URL state looks simpler and is
 * wrong. Every keystroke would become a navigation, and because a navigation
 * is not synchronous, React re-renders the controlled input with a *stale*
 * value — fast typing visibly drops characters.
 *
 * So the input owns its value locally — it is instant and never drops a
 * keystroke — and the URL is updated on a debounce. That also means the URL
 * reflects *committed* searches rather than every intermediate keystroke, so a
 * copied link matches what the user actually sees.
 *
 * ## The two-way sync
 *
 * Local → URL happens on the debounce. URL → local must also happen, or Back,
 * Forward and Reset would change the query string while the box kept showing
 * the old text. The `lastPushed` ref distinguishes "the URL changed because we
 * just wrote to it" from "the URL changed underneath us", which is what keeps
 * the two effects from fighting each other.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { useDebouncedValue } from '@/shared/hooks';

import { SEARCH_DEBOUNCE_MS } from '../model/list-config';

export interface UseSearchInputResult {
  /** Bind to `input.value` — updates instantly on every keystroke. */
  value: string;
  /** Bind to `input.onChange`. */
  setValue: (value: string) => void;
  /** True while the typed value has not yet reached the URL and the query. */
  isPending: boolean;
}

export function useSearchInput(
  /** The committed term from the URL. */
  urlValue: string,
  /** Writes a committed term back to the URL. */
  onCommit: (value: string) => void,
): UseSearchInputResult {
  const [value, setValue] = useState(urlValue);
  const debounced = useDebouncedValue(value, SEARCH_DEBOUNCE_MS);

  // The last value this hook wrote to the URL. Used to tell our own write
  // apart from an external navigation.
  const lastPushed = useRef(urlValue);

  // Local → URL, once typing settles.
  useEffect(() => {
    if (debounced === lastPushed.current) return;
    lastPushed.current = debounced;
    onCommit(debounced);
  }, [debounced, onCommit]);

  // URL → local, for Back/Forward/Reset and deep links. Skipped when the URL
  // merely caught up with what we just pushed, which would otherwise clobber
  // characters typed during the debounce window.
  useEffect(() => {
    if (urlValue === lastPushed.current) return;
    lastPushed.current = urlValue;
    setValue(urlValue);
  }, [urlValue]);

  return {
    value,
    setValue: useCallback((next: string) => setValue(next), []),
    isPending: value !== urlValue,
  };
}
