import type { FacetCount } from '@presight/shared';
import { describe, expect, it } from 'vitest';

import { facetAccessibleLabel, isSelected, withSelectedAlwaysVisible } from './filter-semantics';

const facets: FacetCount[] = [
  { value: 'Reading', count: 320 },
  { value: 'Traveling', count: 283 },
  { value: 'Cooking', count: 275 },
];

describe('isSelected', () => {
  it('matches case-insensitively, like the API collation', () => {
    expect(isSelected(['Reading'], 'reading')).toBe(true);
    expect(isSelected(['Reading'], 'READING')).toBe(true);
    expect(isSelected(['Reading'], 'Swimming')).toBe(false);
  });

  it('is false for an empty selection', () => {
    expect(isSelected([], 'Reading')).toBe(false);
  });
});

describe('withSelectedAlwaysVisible', () => {
  it('leaves facets untouched when nothing is selected', () => {
    expect(withSelectedAlwaysVisible(facets, [])).toEqual(facets);
  });

  it('keeps a selected value that dropped out of the top 20', () => {
    // The scenario: nationalities [India, Japan] plus hobby Falconry. If no
    // Japanese user has that hobby the server returns [India] only — Japan is
    // still filtering but has no checkbox, so it cannot be removed.
    const result = withSelectedAlwaysVisible([{ value: 'India', count: 12 }], ['India', 'Japan']);

    expect(result).toEqual([
      { value: 'India', count: 12 },
      { value: 'Japan', count: 0 },
    ]);
  });

  it('reports a vanished value as 0, which is the true count', () => {
    const result = withSelectedAlwaysVisible([], ['Falconry']);
    expect(result).toEqual([{ value: 'Falconry', count: 0 }]);
  });

  it('floats selected values to the top so they cannot scroll out of view', () => {
    const result = withSelectedAlwaysVisible(facets, ['Cooking']);
    expect(result.map((facet) => facet.value)).toEqual(['Cooking', 'Reading', 'Traveling']);
  });

  it('preserves the server ordering among unselected values', () => {
    const result = withSelectedAlwaysVisible(facets, ['Traveling']);
    expect(result.map((facet) => facet.value)).toEqual(['Traveling', 'Reading', 'Cooking']);
  });

  it('does not duplicate a selected value that differs only in case', () => {
    const result = withSelectedAlwaysVisible([{ value: 'Reading', count: 5 }], ['reading']);
    expect(result).toHaveLength(1);
  });
});

describe('facetAccessibleLabel', () => {
  it('reads as a sentence rather than two loose tokens', () => {
    expect(facetAccessibleLabel('Reading', 320)).toBe('Reading, 320 users');
  });

  it('singularises one user', () => {
    expect(facetAccessibleLabel('Falconry', 1)).toBe('Falconry, 1 user');
  });
});
