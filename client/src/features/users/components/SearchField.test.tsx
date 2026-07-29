import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SearchField, type SearchFieldProps } from './SearchField';

function setup(overrides: Partial<SearchFieldProps> = {}) {
  const props: SearchFieldProps = {
    value: '',
    onChange: vi.fn(),
    ...overrides,
  };

  render(<SearchField {...props} />);
  return props;
}

describe('input', () => {
  it('is labelled for assistive tech, not only by its placeholder', () => {
    setup();
    // A placeholder disappears on input, so it cannot be the only naming.
    expect(screen.getByLabelText(/search users by first or last name/i)).toBeDefined();
  });

  it('is exposed as a search box', () => {
    setup();
    expect(screen.getByRole('searchbox')).toBeDefined();
  });

  it('shows the current value', () => {
    setup({ value: 'kha' });
    expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('kha');
  });

  it('reports every keystroke, so the caller can debounce', async () => {
    const user = userEvent.setup();
    const props = setup();

    await user.type(screen.getByRole('searchbox'), 'abc');

    // Controlled from outside, so each call carries a single character here;
    // what matters is that nothing is swallowed.
    expect(props.onChange).toHaveBeenCalledTimes(3);
  });
});

describe('clear button', () => {
  it('is absent when the field is empty', () => {
    setup();
    expect(screen.queryByRole('button', { name: /clear search/i })).toBeNull();
  });

  it('appears once there is a value', () => {
    setup({ value: 'kha' });
    expect(screen.getByRole('button', { name: /clear search/i })).toBeDefined();
  });

  it('clears to an empty string', async () => {
    const user = userEvent.setup();
    const props = setup({ value: 'kha' });

    await user.click(screen.getByRole('button', { name: /clear search/i }));
    expect(props.onChange).toHaveBeenCalledWith('');
  });

  it('is keyboard reachable', async () => {
    const user = userEvent.setup();
    const props = setup({ value: 'kha' });

    await user.tab();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /clear search/i }));

    await user.keyboard('{Enter}');
    expect(props.onChange).toHaveBeenCalledWith('');
  });
});

describe('pending state', () => {
  it('says nothing while idle', () => {
    setup({ value: 'kha', isPending: false });
    expect(screen.queryByText('Searching…')).toBeNull();
  });

  it('announces that results are catching up with the typed term', () => {
    setup({ value: 'kha', isPending: true });
    expect(screen.getByText('Searching…')).toBeDefined();
  });
});
