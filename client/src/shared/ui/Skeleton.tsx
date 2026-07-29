/**
 * Loading placeholder.
 *
 * Skeletons must not shift the layout, so callers give the skeleton the same
 * box the real content will occupy. `aria-hidden` keeps the
 * decoration out of the accessibility tree — the live region announcing "loading"
 * is the component's job, not the placeholder's.
 */

import { cn } from '@/shared/lib';

export interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return <div aria-hidden="true" className={cn('bg-subtle animate-pulse rounded', className)} />;
}
