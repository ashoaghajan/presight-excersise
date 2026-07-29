/**
 * Mobile presentation: the same panel in a modal drawer.
 *
 * A modal dialog has obligations beyond looking right, all of which are
 * implemented here because getting them wrong makes the drawer unusable with a
 * keyboard or screen reader:
 *
 *  - **Focus moves in** when it opens, and **returns** to the trigger when it
 *    closes, so the user does not lose their place.
 *  - **Focus is trapped**: Tab from the last control wraps to the first.
 *    Without this, tabbing walks invisibly through the page behind the overlay.
 *  - **Escape closes it**, as every modal is expected to.
 *  - **Background scroll is locked**, or the page scrolls under the drawer.
 *  - `role="dialog"` + `aria-modal` + `aria-labelledby` so it is announced as a
 *    dialog with a name rather than an anonymous group of checkboxes.
 *
 * `<dialog>` was considered; its native modal behaviour is good but styling the
 * backdrop and controlling the animation is still inconsistent across browsers,
 * and the trap below is small enough to own.
 */

import { useEffect, useRef } from 'react';

import { FilterPanel, type FilterPanelProps } from './FilterPanel';

export interface FilterDrawerProps extends FilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function FilterDrawer({ isOpen, onClose, ...panelProps }: FilterDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Remember where focus came from so it can be restored on close.
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!focusable || focusable.length === 0) return;

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;

      // Wrap in both directions rather than letting focus escape the dialog.
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = originalOverflow;
      previouslyFocused?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Presentational overlay. Clicking it closes, but it is not a button —
          keyboard users have Escape and the explicit Close control. */}
      <div
        className="motion-safe:animate-[fade-in_150ms_ease-out] absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
        onClick={onClose}
        data-testid="filter-drawer-overlay"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="filter-drawer-title"
        // `motion-safe:` so the slide is skipped for users who ask for reduced
        // motion — the drawer still appears, just without the movement.
        className="bg-surface motion-safe:animate-[slide-in-left_200ms_cubic-bezier(0.32,0.72,0,1)] absolute inset-y-0 left-0 flex w-[min(20rem,88vw)] flex-col shadow-2xl"
      >
        <div className="border-subtle flex items-center justify-between border-b px-5 py-3.5">
          <h2 id="filter-drawer-title" className="text-ink text-base font-semibold">
            Filters
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            // 44px hit area: the WCAG target-size minimum, and the difference
            // between a comfortable tap and a missed one.
            className="text-muted hover:text-ink hover:bg-canvas -mr-2 flex h-11 w-11 items-center justify-center rounded-lg transition-colors"
          >
            <span aria-hidden="true" className="text-2xl leading-none">
              ×
            </span>
            <span className="sr-only">Close filters</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {/* The dialog header above already provides the accessible name. */}
          <FilterPanel {...panelProps} showHeading={false} />
        </div>
      </div>
    </div>
  );
}
