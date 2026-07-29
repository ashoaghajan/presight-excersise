/**
 * One facet row: checkbox, label, count.
 *
 * Built on a **native `<input type="checkbox">`** rather than a styled `<div
 * role="checkbox">`. That single choice supplies keyboard operation (Space to
 * toggle), the correct screen-reader role and checked state, form semantics and
 * focus handling — all of which would otherwise have to be re-implemented, and
 * usually incompletely. The input is visually hidden but never
 * `display: none`, so it stays focusable and announceable; the visible box is
 * drawn by a sibling and driven by `peer-*` variants.
 *
 * Wrapping everything in `<label>` means the whole row is a hit target, which
 * matters most on touch.
 */

import { cn } from '@/shared/lib';
import { VisuallyHidden } from '@/shared/ui';

import { facetAccessibleLabel } from '../model/filter-semantics';

export interface FilterCheckboxProps {
  value: string;
  count: number;
  checked: boolean;
  onToggle: (value: string) => void;
}

export function FilterCheckbox({ value, count, checked, onToggle }: FilterCheckboxProps) {
  return (
    <label
      className={cn(
        'group flex cursor-pointer items-center gap-3 rounded-lg px-2',
        // 40px tall on desktop, 44px on touch — comfortably tappable without
        // making a 20-item list absurdly long.
        'min-h-11 py-2 sm:min-h-10',
        'hover:bg-canvas transition-colors',
        // The row highlights when its hidden input has focus, so keyboard users
        // can see where they are without an outline around the whole label.
        'has-[:focus-visible]:bg-canvas has-[:focus-visible]:ring-primary has-[:focus-visible]:ring-2',
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onToggle(value)}
        className="peer sr-only"
      />

      {/* Visual checkbox. `aria-hidden` because the real input above already
          conveys the state — announcing it twice is noise. */}
      <span
        aria-hidden="true"
        className={cn(
          'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border transition-colors',
          checked ? 'border-primary bg-primary' : 'border-subtle bg-surface',
        )}
      >
        {checked && (
          <svg viewBox="0 0 12 10" className="h-2.5 w-3 fill-none stroke-white stroke-2">
            <polyline points="1,5 4.5,8.5 11,1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>

      {/* Both visible pieces are aria-hidden and the accessible name comes from
          the single phrase below. Otherwise the label concatenates everything
          and announces "Reading Reading, 320 users". */}
      <span
        aria-hidden="true"
        className={cn('flex-1 truncate text-sm', checked ? 'text-ink font-medium' : 'text-ink')}
      >
        {value}
      </span>
      <span aria-hidden="true" className="text-muted text-xs tabular-nums">
        {count.toLocaleString()}
      </span>

      <VisuallyHidden>{facetAccessibleLabel(value, count)}</VisuallyHidden>
    </label>
  );
}
