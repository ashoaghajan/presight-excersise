/**
 * Display labels for the sort vocabulary.
 *
 * The raw field names are database columns (`first_name`), which must not reach
 * the UI. The lists are derived from `SORT_FIELDS` / `SORT_DIRECTIONS` in
 * `@presight/shared` rather than re-declared, so the control can never offer a
 * sort the API would reject — or miss one it accepts.
 */

import { SORT_FIELDS, type SortDirection, type SortField } from '@presight/shared';

export const SORT_FIELD_LABELS: Record<SortField, string> = {
  first_name: 'First name',
  last_name: 'Last name',
  age: 'Age',
  nationality: 'Nationality',
};

/** Options for the field select, in the order the API declares them. */
export const SORT_FIELD_OPTIONS: readonly { value: SortField; label: string }[] = SORT_FIELDS.map(
  (field) => ({ value: field, label: SORT_FIELD_LABELS[field] }),
);

/**
 * Direction labels depend on the field.
 *
 * "Ascending" is technically correct everywhere and helpful nowhere: for a name
 * the user thinks "A–Z", for an age "youngest first". Naming the actual effect
 * removes a small guess every time the control is read — and it is the same
 * information, so it costs nothing.
 */
const DIRECTION_LABELS: Record<SortField, Record<SortDirection, string>> = {
  first_name: { asc: 'A–Z', desc: 'Z–A' },
  last_name: { asc: 'A–Z', desc: 'Z–A' },
  nationality: { asc: 'A–Z', desc: 'Z–A' },
  age: { asc: 'Youngest first', desc: 'Oldest first' },
};

export function sortDirectionLabel(field: SortField, direction: SortDirection): string {
  return DIRECTION_LABELS[field][direction];
}

/**
 * Full phrase for assistive tech, e.g. "Sorted by Age, youngest first".
 * The visible control shows the short form; this spells out what it means.
 */
export function sortAccessibleDescription(field: SortField, direction: SortDirection): string {
  const directionLabel = sortDirectionLabel(field, direction).toLowerCase();
  return `Sorted by ${SORT_FIELD_LABELS[field]}, ${directionLabel}`;
}

/** The direction a toggle would switch to. */
export function oppositeDirection(direction: SortDirection): SortDirection {
  return direction === 'asc' ? 'desc' : 'asc';
}
