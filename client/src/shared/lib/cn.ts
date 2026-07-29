/**
 * Joins class names, dropping falsy entries.
 *
 * Deliberately not `clsx` — this is the whole of what the app needs from it,
 * and a dependency for six lines is not a trade worth making.
 */
export function cn(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(' ');
}
