/**
 * Behavioural tests for the sidebar.
 *
 * Queries are by accessible role and name throughout — if a test can find the
 * control, a screen reader can too, so these double as accessibility
 * assertions rather than just clicking DOM nodes.
 */

import type { FacetCount } from '@presight/shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { FilterPanel, type FilterPanelProps } from './FilterPanel';

const nationalities: FacetCount[] = [
  { value: 'India', count: 178 },
  { value: 'United Arab Emirates', count: 134 },
];

const hobbies: FacetCount[] = [
  { value: 'Reading', count: 320 },
  { value: 'Swimming', count: 215 },
];

function setup(overrides: Partial<FilterPanelProps> = {}) {
  const props: FilterPanelProps = {
    nationalities,
    hobbies,
    selectedNationalities: [],
    selectedHobbies: [],
    onToggleNationality: vi.fn(),
    onToggleHobby: vi.fn(),
    onClearAll: vi.fn(),
    isLoading: false,
    ...overrides,
  };

  render(<FilterPanel {...props} />);
  return props;
}

describe('rendering facets', () => {
  it('shows every nationality and hobby with its count', () => {
    setup();

    expect(screen.getByRole('checkbox', { name: 'India, 178 users' })).toBeDefined();
    expect(screen.getByRole('checkbox', { name: 'United Arab Emirates, 134 users' })).toBeDefined();
    expect(screen.getByRole('checkbox', { name: 'Reading, 320 users' })).toBeDefined();
    expect(screen.getByRole('checkbox', { name: 'Swimming, 215 users' })).toBeDefined();
  });

  it('groups the two facet kinds so their names are announced with each control', () => {
    setup();

    // fieldset/legend surfaces as a `group` role with an accessible name.
    expect(screen.getByRole('group', { name: /Nationality/ })).toBeDefined();
    expect(screen.getByRole('group', { name: /Hobbies/ })).toBeDefined();
  });

  it('states the AND/OR semantics, which are not guessable from the UI', () => {
    setup();

    expect(
      within(screen.getByRole('group', { name: /Nationality/ })).getByText(/any selected/i),
    ).toBeDefined();
    expect(
      within(screen.getByRole('group', { name: /Hobbies/ })).getByText(/all selected/i),
    ).toBeDefined();
  });

  it('reflects selection state on the controls themselves', () => {
    setup({ selectedHobbies: ['Reading'] });

    expect(
      (screen.getByRole('checkbox', { name: 'Reading, 320 users' }) as HTMLInputElement).checked,
    ).toBe(true);
    expect(
      (screen.getByRole('checkbox', { name: 'Swimming, 215 users' }) as HTMLInputElement).checked,
    ).toBe(false);
  });
});

describe('multi-select', () => {
  it('reports each toggle with the value that was clicked', async () => {
    const user = userEvent.setup();
    const props = setup();

    await user.click(screen.getByRole('checkbox', { name: 'Reading, 320 users' }));
    expect(props.onToggleHobby).toHaveBeenCalledWith('Reading');

    await user.click(screen.getByRole('checkbox', { name: 'India, 178 users' }));
    expect(props.onToggleNationality).toHaveBeenCalledWith('India');
  });

  it('allows several selections in the same group', () => {
    setup({ selectedHobbies: ['Reading', 'Swimming'] });

    expect(
      (screen.getByRole('checkbox', { name: 'Reading, 320 users' }) as HTMLInputElement).checked,
    ).toBe(true);
    expect(
      (screen.getByRole('checkbox', { name: 'Swimming, 215 users' }) as HTMLInputElement).checked,
    ).toBe(true);
  });

  it('untoggles an already-selected value', async () => {
    const user = userEvent.setup();
    const props = setup({ selectedHobbies: ['Reading'] });

    await user.click(screen.getByRole('checkbox', { name: 'Reading, 320 users' }));
    expect(props.onToggleHobby).toHaveBeenCalledWith('Reading');
  });
});

describe('keyboard accessibility', () => {
  it('reaches checkboxes with Tab and toggles them with Space', async () => {
    const user = userEvent.setup();
    const props = setup();

    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('checkbox', { name: 'India, 178 users' }));

    await user.keyboard(' ');
    expect(props.onToggleNationality).toHaveBeenCalledWith('India');
  });

  it('keeps every checkbox in the tab order', async () => {
    const user = userEvent.setup();
    setup();

    // Tabbing four times must land on all four checkboxes and nothing else.
    // This is the real guard against hiding the input with `display: none`,
    // which would look identical but drop it from the tab order entirely.
    const reached: Element[] = [];
    for (let i = 0; i < 4; i += 1) {
      await user.tab();
      if (document.activeElement) reached.push(document.activeElement);
    }

    expect(reached).toEqual(screen.getAllByRole('checkbox'));
  });
});

describe('clear all', () => {
  it('is hidden when nothing is selected', () => {
    setup();
    expect(screen.queryByRole('button', { name: /clear all/i })).toBeNull();
  });

  it('appears once a filter is applied and reports the count to screen readers', () => {
    setup({ selectedHobbies: ['Reading'], selectedNationalities: ['India'] });

    expect(screen.getByRole('button', { name: /2 currently applied/i })).toBeDefined();
  });

  it('calls back when pressed', async () => {
    const user = userEvent.setup();
    const props = setup({ selectedHobbies: ['Reading'] });

    await user.click(screen.getByRole('button', { name: /clear all/i }));
    expect(props.onClearAll).toHaveBeenCalledTimes(1);
  });
});

describe('a selected value that fell out of the top 20', () => {
  it('still renders, checked, so it can be removed', async () => {
    const user = userEvent.setup();
    // The server no longer returns Japan, but it is still filtering.
    const props = setup({
      nationalities: [{ value: 'India', count: 12 }],
      selectedNationalities: ['India', 'Japan'],
    });

    const japan = screen.getByRole('checkbox', { name: 'Japan, 0 users' }) as HTMLInputElement;
    expect(japan.checked).toBe(true);

    await user.click(japan);
    expect(props.onToggleNationality).toHaveBeenCalledWith('Japan');
  });
});

describe('loading state', () => {
  it('shows placeholders instead of controls on first load', () => {
    setup({ isLoading: true, nationalities: [], hobbies: [] });

    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    // Groups keep their headings, so the layout does not shift when data lands.
    expect(screen.getByRole('group', { name: /Nationality/ })).toBeDefined();
  });
});

describe('empty facets', () => {
  it('explains why a group is empty rather than showing nothing', () => {
    setup({ hobbies: [], nationalities: [] });

    expect(screen.getAllByText(/no options match/i)).toHaveLength(2);
  });
});
