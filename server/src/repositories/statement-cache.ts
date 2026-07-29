/**
 * Prepared-statement cache.
 *
 * `db.prepare()` parses and plans the SQL every time it is called. The
 * repository builds its SQL dynamically (the number of `?` placeholders depends
 * on how many filters are selected), so it cannot hold a fixed set of
 * statements at module load — but the *set of distinct SQL strings* it can
 * produce is small and highly repetitive, since users mostly re-issue the same
 * filter shape while scrolling.
 *
 * Caching by SQL text turns every page beyond the first into a pure bind-and-run.
 */

import type { Statement } from 'better-sqlite3';

import type { Db } from '../db';

/**
 * Distinct SQL shapes are bounded by (search on/off) x (nationality count) x
 * (hobby count) x (sort field) x (direction), so the cache converges quickly.
 * The cap only exists so a pathological client cannot grow it without limit;
 * clearing wholesale is fine because re-preparing is cheap.
 */
const MAX_CACHED_STATEMENTS = 256;

export interface StatementCache {
  prepare<Row>(sql: string): Statement<unknown[], Row>;
}

export function createStatementCache(db: Db): StatementCache {
  const cache = new Map<string, Statement<unknown[], unknown>>();

  return {
    prepare<Row>(sql: string): Statement<unknown[], Row> {
      const cached = cache.get(sql);
      if (cached) return cached as Statement<unknown[], Row>;

      if (cache.size >= MAX_CACHED_STATEMENTS) cache.clear();

      const statement = db.prepare<unknown[], Row>(sql);
      cache.set(sql, statement as Statement<unknown[], unknown>);
      return statement;
    },
  };
}
