/**
 * Tests for the mobile drawer's modal obligations.
 *
 * These are the parts that are invisible in a screenshot but make the drawer
 * usable — or unusable — with a keyboard or screen reader.
 */

import type { FacetCount } from '@presight/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { FilterDrawer, type FilterDrawerProps } from './FilterDrawer';

const nationalities: FacetCount[] = [{ value: 'India', count: 178 }];
const hobbies: FacetCount[] = [{ value: 'Reading', count: 320 }];

function setup(overrides: Partial<FilterDrawerProps> = {}) {
  const props: FilterDrawerProps = {
    nationalities,
    hobbies,
    selectedNationalities: [],
    selectedHobbies: [],
    onToggleNationality: vi.fn(),
    onToggleHobby: vi.fn(),
    onClearAll: vi.fn(),
    isLoading: false,
    isOpen: true,
    onClose: vi.fn(),
    ...overrides,
  };

  const view = render(<FilterDrawer {...props} />);
  return { props, view };
}

describe('visibility', () => {
  it('renders nothing when closed', () => {
    setup({ isOpen: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('is announced as a named modal dialog', () => {
    setup();

    const dialog = screen.getByRole('dialog', { name: 'Filters' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  it('shows the same filter content as the sidebar', () => {
    setup();

    expect(screen.getByRole('checkbox', { name: 'India, 178 users' })).toBeDefined();
    expect(screen.getByRole('checkbox', { name: 'Reading, 320 users' })).toBeDefined();
  });

  it('does not repeat the "Filters" heading inside the dialog body', () => {
    setup();
    // The dialog header supplies the name; the panel suppresses its own.
    expect(screen.getAllByText('Filters')).toHaveLength(1);
  });
});

describe('closing', () => {
  it('closes on Escape', async () => {
    const user = userEvent.setup();
    const { props } = setup();

    await user.keyboard('{Escape}');
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on the Close button', async () => {
    const user = userEvent.setup();
    const { props } = setup();

    await user.click(screen.getByRole('button', { name: 'Close filters' }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when the overlay is clicked', async () => {
    const user = userEvent.setup();
    const { props } = setup();

    await user.click(screen.getByTestId('filter-drawer-overlay'));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});

describe('focus management', () => {
  it('moves focus into the dialog on open', () => {
    setup();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close filters' }));
  });

  it('traps Tab inside the dialog', async () => {
    const user = userEvent.setup();
    setup();

    const dialog = screen.getByRole('dialog');

    // Tab through more controls than the dialog contains; focus must never
    // escape to the page behind the overlay.
    for (let i = 0; i < 6; i += 1) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });

  it('traps Shift+Tab too', async () => {
    const user = userEvent.setup();
    setup();

    const dialog = screen.getByRole('dialog');

    for (let i = 0; i < 6; i += 1) {
      await user.tab({ shift: true });
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });

  it('restores focus to the trigger when it closes', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const { view } = setup();
    expect(document.activeElement).not.toBe(trigger);

    view.unmount();
    expect(document.activeElement).toBe(trigger);

    trigger.remove();
  });
});

describe('background scroll', () => {
  it('locks page scroll while open and restores it on close', () => {
    const { view } = setup();
    expect(document.body.style.overflow).toBe('hidden');

    view.unmount();
    expect(document.body.style.overflow).not.toBe('hidden');
  });
});
