/**
 * Deterministic pseudo-random number generation for the seeder.
 *
 * `Math.random()` is deliberately never used: with a fixed seed, the same
 * command produces byte-identical data every time. That is what makes the
 * directory reproducible for screenshots, for reviewers and — most usefully —
 * for tests that want to assert on concrete counts ("Reading appears 412
 * times") without querying for them first.
 */

/**
 * mulberry32 — a small, fast, well-distributed 32-bit PRNG. Chosen over a
 * cryptographic generator because seeding is the entire point here; unguessable
 * output is not a requirement.
 */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Weighted<T> {
  value: T;
  weight: number;
}

export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [min, max], both inclusive. */
  int(min: number, max: number): number;
  /** Uniform choice. */
  pick<T>(items: readonly T[]): T;
  /** Choice proportional to `weight`. */
  weighted<T>(items: readonly Weighted<T>[]): T;
  /**
   * `count` distinct items chosen with probability proportional to weight.
   * Returns fewer items only if `count` exceeds the pool size.
   */
  weightedSample<T>(items: readonly Weighted<T>[], count: number): T[];
}

export function createRng(seed: number): Rng {
  const next = mulberry32(seed);

  function pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Cannot pick from an empty list');
    // `noUncheckedIndexedAccess` is on, so the bounds check above is not enough
    // for the compiler; the non-null assertion is safe given that guard.
    return items[Math.floor(next() * items.length)]!;
  }

  function weighted<T>(items: readonly Weighted<T>[]): T {
    const total = items.reduce((sum, item) => sum + item.weight, 0);
    if (total <= 0) throw new Error('Cannot pick from a zero-weight list');

    let threshold = next() * total;
    for (const item of items) {
      threshold -= item.weight;
      if (threshold < 0) return item.value;
    }
    // Only reachable through floating-point drift on the final element.
    return items[items.length - 1]!.value;
  }

  function weightedSample<T>(items: readonly Weighted<T>[], count: number): T[] {
    if (count <= 0) return [];

    // Efraimidis-Spirakis: give each item the key u^(1/weight) and take the
    // `count` largest. One pass, no rejection loop, and the result is a genuine
    // weighted sample *without replacement* — which matters because a user must
    // not be given the same hobby twice.
    return items
      .map((item) => ({ value: item.value, key: next() ** (1 / item.weight) }))
      .sort((a, b) => b.key - a.key)
      .slice(0, count)
      .map((entry) => entry.value);
  }

  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick,
    weighted,
    weightedSample,
  };
}
