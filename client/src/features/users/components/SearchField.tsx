/**
 * The name search box.
 *
 * Presentational: it renders a controlled input and reports changes. The
 * debounce and the URL write live in `hooks/useSearchInput`, which is what
 * keeps this component trivial to test and stops the timing logic from being
 * duplicated per usage.
 *
 * `type="search"` rather than `type="text"`: it gets the right on-screen
 * keyboard on mobile and is announced as a search field. The native clear
 * affordance is suppressed (`[&::-webkit-search-cancel-button]:hidden`) in
 * favour of an explicit button, because the native one is invisible to
 * keyboard users in several browsers.
 */

import { cn } from '@/shared/lib';

export interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** True while the typed value has not yet reached the query. */
  isPending?: boolean;
  className?: string;
}

export function SearchField({ value, onChange, isPending = false, className }: SearchFieldProps) {
  return (
    // No flex sizing baked in: the component does not own the layout it sits
    // in, and hard-coding `flex-1` here made it shrink onto a crowded mobile
    // header row instead of wrapping to its own line.
    <div className={cn('relative min-w-0', className)}>
      {/* A visible label would compete with the sort controls for header space,
          so the field is labelled for assistive tech and given a placeholder
          for sighted users. The placeholder is not the label — it disappears on
          input, which is exactly why it cannot be the only naming. */}
      <label htmlFor="user-search" className="sr-only">
        Search users by first or last name
      </label>

      <span
        aria-hidden="true"
        className="text-muted pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm"
      >
        ⌕
      </span>

      <input
        id="user-search"
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search by name…"
        autoComplete="off"
        className={cn(
          'border-subtle bg-surface text-ink placeholder:text-muted h-9 w-full rounded-lg border pr-9 pl-8 text-sm',
          'focus:border-primary transition-colors',
          '[&::-webkit-search-cancel-button]:hidden',
        )}
      />

      {value !== '' && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="text-muted hover:text-ink absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-sm leading-none"
        >
          <span aria-hidden="true">×</span>
          <span className="sr-only">Clear search</span>
        </button>
      )}

      {/* Search is debounced, so there is a window where the field and the
          results disagree. Saying so is better than letting it look stale. */}
      <span aria-live="polite" className="sr-only">
        {isPending ? 'Searching…' : ''}
      </span>
    </div>
  );
}
