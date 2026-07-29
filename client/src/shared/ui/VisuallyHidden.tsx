/**
 * Content available to screen readers but not shown visually.
 *
 * Used for things sighted users read from context but assistive tech cannot —
 * e.g. the word "users" after a facet count, so `Reading (320)` is announced
 * as "Reading, 320 users" rather than "Reading 320".
 *
 * Uses the clip-rect technique rather than `display: none` or `visibility:
 * hidden`, both of which remove the element from the accessibility tree too.
 */

import type { ElementType, ReactNode } from 'react';

export interface VisuallyHiddenProps {
  children: ReactNode;
  as?: ElementType;
}

export function VisuallyHidden({ children, as: Tag = 'span' }: VisuallyHiddenProps) {
  return <Tag className="sr-only">{children}</Tag>;
}
