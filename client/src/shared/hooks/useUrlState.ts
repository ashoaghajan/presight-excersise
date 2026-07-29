/**
 * Generic URL-as-state primitive.
 *
 * Wraps React Router's `useSearchParams` with the two things every URL-synced
 * value needs and none of them should re-implement:
 *
 *  1. **A typed codec.** The caller supplies `parse` / `serialize`, so the hook
 *     hands back a real typed object rather than raw strings, and there is one
 *     place per feature where "what does this parameter mean" is decided.
 *  2. **Explicit history intent.** Whether an update should be a new history
 *     entry is a property of the *interaction*, not of the hook — so it is a
 *     per-call argument (see `HistoryMode`).
 *
 * Deliberately feature-agnostic: it knows nothing about users, hobbies or
 * sorting. `features/users/hooks/useUsersQueryState.ts` is the typed binding
 * that gives it meaning.
 */

import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * How an update should affect the browser history stack.
 *
 * - `push` — a new entry, so Back undoes exactly this change. Correct for
 *   discrete, deliberate actions: ticking a filter, changing the sort.
 * - `replace` — overwrites the current entry. Correct for continuous input,
 *   where pushing would bury the user's real previous state under dozens of
 *   intermediate states (one per keystroke).
 */
export type HistoryMode = 'push' | 'replace';

export interface UrlStateCodec<TState> {
  /** Must be total: any URL, however malformed, has to yield a valid state. */
  parse: (params: URLSearchParams) => TState;
  /** Should omit defaults so the canonical view stays a clean URL. */
  serialize: (state: TState) => URLSearchParams;
}

export interface UseUrlStateResult<TState> {
  state: TState;
  /**
   * Replaces the whole state. Accepts an updater so callers can derive the next
   * state from the current one without depending on a stale closure.
   */
  setState: (next: TState | ((current: TState) => TState), mode?: HistoryMode) => void;
  /** Returns to the state an empty query string parses to. */
  reset: (mode?: HistoryMode) => void;
}

export function useUrlState<TState>(
  codec: UrlStateCodec<TState>,
  /** Default history behaviour when a call does not specify one. */
  defaultMode: HistoryMode = 'push',
): UseUrlStateResult<TState> {
  const [searchParams, setSearchParams] = useSearchParams();

  // The string, not the instance, is the dependency: React Router returns a new
  // URLSearchParams object on every render, so depending on the instance would
  // re-parse (and hand back a new state object) on every single render, which
  // in turn invalidates every downstream memo and query key.
  const searchString = searchParams.toString();

  const state = useMemo(
    () => codec.parse(new URLSearchParams(searchString)),
    // `codec` is intentionally not a dependency: callers define it inline, so a
    // new object identity every render would defeat the memo entirely. The
    // codec is expected to be pure and stable in behaviour, which is exactly
    // why it is a pure module-level function in every current usage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchString],
  );

  const setState = useCallback(
    (next: TState | ((current: TState) => TState), mode: HistoryMode = defaultMode) => {
      setSearchParams(
        // Functional form: React Router hands us the *current* params, so an
        // update computed from them is correct even when two updates land in
        // the same tick (e.g. a filter toggle and a sort change from one
        // handler). Deriving from the closed-over `state` would lose the first.
        (current) => {
          const currentState = codec.parse(current);
          const nextState =
            typeof next === 'function' ? (next as (c: TState) => TState)(currentState) : next;
          return codec.serialize(nextState);
        },
        { replace: mode === 'replace' },
      );
    },
    // Same reasoning as above for `codec`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setSearchParams, defaultMode],
  );

  const reset = useCallback(
    (mode: HistoryMode = defaultMode) => {
      setSearchParams(new URLSearchParams(), { replace: mode === 'replace' });
    },
    [setSearchParams, defaultMode],
  );

  return { state, setState, reset };
}
