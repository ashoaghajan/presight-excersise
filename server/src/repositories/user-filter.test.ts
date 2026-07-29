/**
 * Filter semantics, checked against the oracle in `test/fixture.ts`.
 *
 * These are the requirements most easily got wrong in a way that still *looks*
 * plausible: hobby AND silently behaving as OR returns a larger, entirely
 * reasonable-looking set. So every assertion here compares against an
 * independent reimplementation rather than against a hand-picked number.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createTestContext,
  expectedUsers,
  query,
  type OracleUser,
  type TestContext,
} from '../test/fixture';

let ctx: TestContext;

beforeAll(() => {
  ctx = createTestContext();
});

afterAll(() => ctx.close());

/** Ids the repository returns for a query, unpaginated. */
function actualIds(overrides: Parameters<typeof query>[0]): number[] {
  const q = query({ ...overrides, limit: 100, page: 1 });
  const total = ctx.userRepository.countUsers(q);
  const ids: number[] = [];

  for (let page = 1; ids.length < total; page++) {
    const rows = ctx.userRepository.searchUsers(query({ ...overrides, limit: 100, page }));
    if (rows.length === 0) break;
    ids.push(...rows.map((row) => row.id));
  }

  return ids.sort((a, b) => a - b);
}

function expectedIds(users: OracleUser[]): number[] {
  return users.map((user) => user.id).sort((a, b) => a - b);
}

/** The most common values, so the combinations tested are not all near-empty. */
function topValues(kind: 'hobbies' | 'nationalities', count: number): string[] {
  const tally = new Map<string, number>();
  for (const user of ctx.oracle) {
    const values = kind === 'hobbies' ? user.hobbies : [user.nationality];
    for (const value of values) tally.set(value, (tally.get(value) ?? 0) + 1);
  }
  return [...tally.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([value]) => value);
}

describe('search', () => {
  it('matches across first_name and last_name', () => {
    for (const term of ['a', 'an', 'el', 'kh', 'ro']) {
      expect(actualIds({ search: term }), `search=${term}`).toEqual(
        expectedIds(expectedUsers(ctx.oracle, { search: term })),
      );
    }
  });

  it('is case-insensitive', () => {
    const sample = ctx.oracle[0]!.last_name;
    const counts = [sample, sample.toLowerCase(), sample.toUpperCase()].map((term) =>
      ctx.userRepository.countUsers(query({ search: term })),
    );
    expect(new Set(counts).size).toBe(1);
    expect(counts[0]).toBeGreaterThan(0);
  });

  it('matches substrings, not just prefixes', () => {
    const name = ctx.oracle[0]!.first_name;
    const middle = name.slice(1, Math.max(2, name.length - 1));
    expect(ctx.userRepository.countUsers(query({ search: middle }))).toBeGreaterThan(0);
  });

  it('treats LIKE wildcards as literal characters', () => {
    // Without ESCAPE handling, '%' matches every row and '_' matches any single
    // character — the search box would silently become a pattern language.
    expect(ctx.userRepository.countUsers(query({ search: '%' }))).toBe(0);
    expect(ctx.userRepository.countUsers(query({ search: '_' }))).toBe(0);
    expect(ctx.userRepository.countUsers(query({ search: '%a%' }))).toBe(0);
  });

  it('ignores surrounding whitespace', () => {
    const term = ctx.oracle[0]!.first_name;
    expect(ctx.userRepository.countUsers(query({ search: `  ${term}  ` }))).toBe(
      ctx.userRepository.countUsers(query({ search: term })),
    );
  });
});

describe('nationality filter — OR', () => {
  it('matches the oracle for every single nationality', () => {
    for (const nationality of topValues('nationalities', 24)) {
      expect(actualIds({ nationalities: [nationality] }), nationality).toEqual(
        expectedIds(expectedUsers(ctx.oracle, { nationalities: [nationality] })),
      );
    }
  });

  it('is exactly additive across pairs', () => {
    // A user holds exactly one nationality, so OR over two values must return
    // precisely the sum of the parts. This is a stronger check than set
    // equality: it fails if the filter ever double-counts or intersects.
    const values = topValues('nationalities', 8);
    for (let i = 0; i < values.length - 1; i++) {
      const a = values[i]!;
      const b = values[i + 1]!;
      const countA = ctx.userRepository.countUsers(query({ nationalities: [a] }));
      const countB = ctx.userRepository.countUsers(query({ nationalities: [b] }));
      const countBoth = ctx.userRepository.countUsers(query({ nationalities: [a, b] }));
      expect(countBoth, `${a}+${b}`).toBe(countA + countB);
    }
  });

  it('returns every user when all nationalities are selected', () => {
    const all = [...new Set(ctx.oracle.map((user) => user.nationality))];
    expect(ctx.userRepository.countUsers(query({ nationalities: all }))).toBe(ctx.oracle.length);
  });

  it('ignores an unmatched value (known + unknown = known)', () => {
    const known = topValues('nationalities', 1)[0]!;
    expect(ctx.userRepository.countUsers(query({ nationalities: [known, 'Atlantis'] }))).toBe(
      ctx.userRepository.countUsers(query({ nationalities: [known] })),
    );
  });

  it('matches case-insensitively', () => {
    const known = topValues('nationalities', 1)[0]!;
    expect(ctx.userRepository.countUsers(query({ nationalities: [known.toLowerCase()] }))).toBe(
      ctx.userRepository.countUsers(query({ nationalities: [known] })),
    );
  });
});

describe('hobby filter — AND', () => {
  it('matches the oracle for every single hobby', () => {
    for (const hobby of topValues('hobbies', 44)) {
      expect(actualIds({ hobbies: [hobby] }), hobby).toEqual(
        expectedIds(expectedUsers(ctx.oracle, { hobbies: [hobby] })),
      );
    }
  });

  it('matches the oracle for every pair of the ten most common hobbies', () => {
    const values = topValues('hobbies', 10);
    for (let i = 0; i < values.length; i++) {
      for (let j = i + 1; j < values.length; j++) {
        const pair = [values[i]!, values[j]!];
        expect(actualIds({ hobbies: pair }), pair.join('+')).toEqual(
          expectedIds(expectedUsers(ctx.oracle, { hobbies: pair })),
        );
      }
    }
  });

  it('matches the oracle for sampled triples', () => {
    const values = topValues('hobbies', 6);
    for (let i = 0; i < values.length - 2; i++) {
      const triple = [values[i]!, values[i + 1]!, values[i + 2]!];
      expect(actualIds({ hobbies: triple }), triple.join('+')).toEqual(
        expectedIds(expectedUsers(ctx.oracle, { hobbies: triple })),
      );
    }
  });

  it('narrows monotonically as hobbies are added', () => {
    const [a, b, c] = topValues('hobbies', 3) as [string, string, string];
    const one = ctx.userRepository.countUsers(query({ hobbies: [a] }));
    const two = ctx.userRepository.countUsers(query({ hobbies: [a, b] }));
    const three = ctx.userRepository.countUsers(query({ hobbies: [a, b, c] }));
    expect(one).toBeGreaterThanOrEqual(two);
    expect(two).toBeGreaterThanOrEqual(three);
  });

  it('returns only users holding every selected hobby', () => {
    const [a, b] = topValues('hobbies', 2) as [string, string];
    const rows = ctx.userRepository.searchUsers(query({ hobbies: [a, b], limit: 100 }));
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.hobbies).toContain(a);
      expect(row.hobbies).toContain(b);
    }
  });

  it('returns nothing when one selected hobby is unknown', () => {
    const known = topValues('hobbies', 1)[0]!;
    // The mirror image of the nationality case: AND with something nobody has
    // must be empty, not a partial match.
    expect(ctx.userRepository.countUsers(query({ hobbies: [known, 'Quidditch'] }))).toBe(0);
  });

  it('is not corrupted by duplicate or case-variant values', () => {
    // The HAVING target is the number of requested hobbies, so an
    // un-deduplicated repeat would demand two distinct matches for one hobby
    // and silently return zero rows.
    const known = topValues('hobbies', 1)[0]!;
    const baseline = ctx.userRepository.countUsers(query({ hobbies: [known] }));
    expect(ctx.userRepository.countUsers(query({ hobbies: [known, known] }))).toBe(baseline);
    expect(
      ctx.userRepository.countUsers(
        query({ hobbies: [known, known.toUpperCase(), known.toLowerCase()] }),
      ),
    ).toBe(baseline);
  });
});

describe('filters compose', () => {
  it('applies search AND nationality-OR AND hobby-AND together', () => {
    const nationalities = topValues('nationalities', 3);
    const hobbies = topValues('hobbies', 3);

    for (const search of ['', 'a', 'an']) {
      for (const nationality of nationalities) {
        for (const hobby of hobbies) {
          const combo = {
            search,
            nationalities: [nationality],
            hobbies: [hobby],
          };
          expect(actualIds(combo), JSON.stringify(combo)).toEqual(
            expectedIds(expectedUsers(ctx.oracle, combo)),
          );
        }
      }
    }
  });
});

describe('injection safety', () => {
  it('treats hostile input as data', () => {
    const hostile = "'; DROP TABLE users; --";
    expect(() =>
      ctx.userRepository.searchUsers(
        query({ search: hostile, nationalities: [hostile], hobbies: [hostile] }),
      ),
    ).not.toThrow();

    // The table is still there and still complete.
    expect(ctx.userRepository.countUsers(query())).toBe(ctx.oracle.length);
  });
});
