/**
 * Sort field select + direction toggle.
 *
 * Presentational, like `filters`: it receives the current sort and reports
 * changes through callbacks, so it has no dependency on the `users` feature and
 * no knowledge that a URL exists.
 *
 * A native `<select>` is used for the field rather than a custom dropdown. It
 * brings keyboard behaviour (type-ahead, arrow keys, Home/End), correct screen
 * reader semantics, and the platform picker on mobile — none of which a styled
 * listbox gets without a lot of code, and all of which users already know.
 *
 * The direction is a **toggle button, not a second select**: there are only two
 * values, so a select would cost two interactions (open, choose) where a button
 * costs one.
 */

import { useId } from 'react';
import type { SortDirection, SortField } from '@presight/shared';

import { cn } from '@/shared/lib';

import {
  SORT_FIELD_OPTIONS,
  oppositeDirection,
  sortAccessibleDescription,
  sortDirectionLabel,
} from '../model/sort-labels';

export interface SortControlsProps {
  field: SortField;
  direction: SortDirection;
  onFieldChange: (field: SortField) => void;
  onDirectionChange: (direction: SortDirection) => void;
  /** Compact styling for the mobile header. */
  className?: string;
}

export function SortControls({
  field,
  direction,
  onFieldChange,
  onDirectionChange,
  className,
}: SortControlsProps) {
  const next = oppositeDirection(direction);

  // The page renders this component twice (desktop header and mobile column),
  // so a hard-coded id would be duplicated and the label would bind to
  // whichever appeared first — leaving the other select unlabelled.
  const fieldId = useId();

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <label htmlFor={fieldId} className="text-muted shrink-0 text-sm">
        Sort by
      </label>

      <select
        id={fieldId}
        value={field}
        onChange={(event) => onFieldChange(event.target.value as SortField)}
        className="border-subtle bg-surface text-ink hover:bg-canvas h-9 rounded-lg border px-3 text-sm transition-colors"
      >
        {SORT_FIELD_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={() => onDirectionChange(next)}
        // The accessible name states what pressing will *do*, which is what a
        // screen-reader user needs before activating it. The current state is
        // announced separately via the live description below.
        aria-label={`Change sort direction to ${sortDirectionLabel(field, next).toLowerCase()}`}
        className="border-subtle bg-surface text-ink hover:bg-canvas flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm transition-colors"
      >
        <span aria-hidden="true" className="text-muted">
          {direction === 'asc' ? '↑' : '↓'}
        </span>
        {/* The visible label is short; it is aria-hidden because the button's
            aria-label already carries the full meaning. */}
        <span aria-hidden="true">{sortDirectionLabel(field, direction)}</span>
      </button>

      {/* Sorting re-orders the list without moving focus or navigating, so
          without a live region a screen-reader user gets no confirmation that
          anything happened. */}
      <span aria-live="polite" className="sr-only">
        {sortAccessibleDescription(field, direction)}
      </span>
    </div>
  );
}
