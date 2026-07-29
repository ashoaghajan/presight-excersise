import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SortControls, type SortControlsProps } from './SortControls';

function setup(overrides: Partial<SortControlsProps> = {}) {
  const props: SortControlsProps = {
    field: 'first_name',
    direction: 'asc',
    onFieldChange: vi.fn(),
    onDirectionChange: vi.fn(),
    ...overrides,
  };

  render(<SortControls {...props} />);
  return props;
}

describe('field select', () => {
  it('offers exactly the four fields the API supports', () => {
    setup();

    const select = screen.getByRole('combobox', { name: 'Sort by' });
    const options = [...select.querySelectorAll('option')].map((option) => option.value);

    expect(options).toEqual(['first_name', 'last_name', 'age', 'nationality']);
  });

  it('shows human labels, never raw column names', () => {
    setup();

    expect(screen.getByRole('option', { name: 'First name' })).toBeDefined();
    expect(screen.queryByText('first_name')).toBeNull();
  });

  it('reflects the current field', () => {
    setup({ field: 'age' });
    expect((screen.getByRole('combobox', { name: 'Sort by' }) as HTMLSelectElement).value).toBe(
      'age',
    );
  });

  it('reports a change', async () => {
    const user = userEvent.setup();
    const props = setup();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort by' }), 'age');
    expect(props.onFieldChange).toHaveBeenCalledWith('age');
  });
});

describe('direction toggle', () => {
  it('reports the opposite direction when pressed', async () => {
    const user = userEvent.setup();
    const props = setup({ direction: 'asc' });

    await user.click(screen.getByRole('button'));
    expect(props.onDirectionChange).toHaveBeenCalledWith('desc');
  });

  it('toggles back from desc', async () => {
    const user = userEvent.setup();
    const props = setup({ direction: 'desc' });

    await user.click(screen.getByRole('button'));
    expect(props.onDirectionChange).toHaveBeenCalledWith('asc');
  });

  it('names the action it will perform, not its current state', () => {
    // A screen-reader user needs to know what activating it does.
    setup({ field: 'first_name', direction: 'asc' });
    expect(screen.getByRole('button', { name: /change sort direction to z–a/i })).toBeDefined();
  });

  it('describes direction in terms of the field being sorted', () => {
    setup({ field: 'age', direction: 'asc' });

    // "Ascending" is correct but unhelpful for an age.
    expect(screen.getByText('Youngest first')).toBeDefined();
    expect(screen.getByRole('button', { name: /oldest first/i })).toBeDefined();
  });
});

describe('accessibility', () => {
  it('labels the select', () => {
    setup();
    expect(screen.getByLabelText('Sort by')).toBeDefined();
  });

  it('announces the resulting order, which is otherwise a silent change', () => {
    setup({ field: 'age', direction: 'desc' });
    expect(screen.getByText('Sorted by Age, oldest first')).toBeDefined();
  });

  it('is reachable and operable by keyboard', async () => {
    const user = userEvent.setup();
    const props = setup();

    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('combobox', { name: 'Sort by' }));

    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button'));

    await user.keyboard('{Enter}');
    expect(props.onDirectionChange).toHaveBeenCalledWith('desc');
  });

  it('gives each instance a unique select id', () => {
    // The page renders this twice at some breakpoints; duplicate ids would
    // leave the second select unlabelled.
    render(
      <>
        <SortControls
          field="age"
          direction="asc"
          onFieldChange={vi.fn()}
          onDirectionChange={vi.fn()}
        />
        <SortControls
          field="age"
          direction="asc"
          onFieldChange={vi.fn()}
          onDirectionChange={vi.fn()}
        />
      </>,
    );

    const ids = screen.getAllByRole('combobox').map((select) => select.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
