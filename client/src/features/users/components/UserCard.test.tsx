import type { UserDto } from '@presight/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { UserCard } from './UserCard';

const baseUser: UserDto = {
  id: 1,
  avatar: 'https://example.test/avatar.svg',
  first_name: 'John',
  last_name: 'Smith',
  age: 34,
  nationality: 'United Arab Emirates',
  hobbies: [],
};

const withHobbies = (hobbies: string[]): UserDto => ({ ...baseUser, hobbies });

describe('card content', () => {
  it('shows full name, nationality and age', () => {
    render(<UserCard user={baseUser} />);

    expect(screen.getByRole('heading', { name: 'John Smith' })).toBeDefined();
    expect(screen.getByText('United Arab Emirates')).toBeDefined();
    expect(screen.getByText('Age: 34')).toBeDefined();
  });

  it('spells out the age for screen readers', () => {
    render(<UserCard user={baseUser} />);
    // "Age: 34" is visual shorthand.
    expect(screen.getByText('34 years old')).toBeDefined();
  });

  it('renders an avatar image', () => {
    render(<UserCard user={baseUser} />);
    const img = document.querySelector('img');
    expect(img?.getAttribute('src')).toBe(baseUser.avatar);
    // Decorative: the name is already text beside it.
    expect(img?.getAttribute('alt')).toBe('');
  });
});

describe('hobby display rules', () => {
  it('shows nothing when the user has no hobbies', () => {
    render(<UserCard user={withHobbies([])} />);
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('shows a single hobby with no overflow badge', () => {
    render(<UserCard user={withHobbies(['Reading'])} />);

    expect(screen.getByText('Reading')).toBeDefined();
    expect(screen.queryByText(/^\+/)).toBeNull();
  });

  it('shows exactly two hobbies with no badge', () => {
    render(<UserCard user={withHobbies(['Reading', 'Swimming'])} />);

    expect(screen.getByText('Reading')).toBeDefined();
    expect(screen.getByText('Swimming')).toBeDefined();
    expect(screen.queryByText(/^\+/)).toBeNull();
  });

  it('caps at two and collapses the rest into +N', () => {
    // e.g. Reading, Swimming, +3
    render(<UserCard user={withHobbies(['Reading', 'Swimming', 'Cooking', 'Chess', 'Yoga'])} />);

    expect(screen.getByText('Reading')).toBeDefined();
    expect(screen.getByText('Swimming')).toBeDefined();
    expect(screen.getByText('+3')).toBeDefined();

    // The hidden ones must not be rendered as chips.
    expect(screen.queryByText('Cooking')).toBeNull();
  });

  it('names the hidden hobbies for screen readers, since "+3" alone is meaningless', () => {
    render(<UserCard user={withHobbies(['Reading', 'Swimming', 'Cooking', 'Chess', 'Yoga'])} />);

    expect(screen.getByText(/and 3 more: Cooking, Chess, Yoga/)).toBeDefined();
  });

  it('handles the maximum of ten hobbies', () => {
    const ten = Array.from({ length: 10 }, (_, index) => `Hobby${index}`);
    render(<UserCard user={withHobbies(ten)} />);

    expect(screen.getByText('+8')).toBeDefined();
    expect(screen.getAllByRole('listitem')).toHaveLength(3); // 2 chips + 1 badge
  });
});

describe('memoisation', () => {
  it('is wrapped in React.memo', () => {
    // The virtualizer re-renders its parent on every scroll frame; without memo
    // every visible card would re-render ~60 times a second.
    expect((UserCard as unknown as { $$typeof: symbol }).$$typeof).toBe(Symbol.for('react.memo'));
  });
});
