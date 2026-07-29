/**
 * Schema, seeding and persistence.
 *
 * The exercise requires SQLite to be the source of truth and the seed to be
 * easy to re-run, so the properties worth protecting are: the migration is
 * idempotent, the seed is deterministic (same seed → same rows *and* same ids),
 * re-running without `--force` does not duplicate data, and what was written
 * survives closing and reopening the file.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

import { runMigrations } from '../migrator';
import { seedDatabase } from './index';
import type { Db } from '../index';

const tempFiles: string[] = [];

afterEach(() => {
  while (tempFiles.length > 0) {
    const file = tempFiles.pop()!;
    for (const suffix of ['', '-wal', '-shm']) {
      fs.rmSync(`${file}${suffix}`, { force: true });
    }
  }
});

function memoryDb(): Db {
  const db = new Database(':memory:') as Db;
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  return db;
}

function tempDbPath(): string {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'presight-')), 'test.sqlite');
  tempFiles.push(file);
  return file;
}

function snapshot(db: Db) {
  return db
    .prepare<
      [],
      { id: number; first_name: string; last_name: string; age: number; nationality: string }
    >('SELECT id, first_name, last_name, age, nationality FROM users ORDER BY id')
    .all();
}

describe('migrations', () => {
  it('are idempotent', () => {
    const db = memoryDb();
    // The first run happened in memoryDb(); a second must apply nothing.
    expect(runMigrations(db)).toEqual([]);
    db.close();
  });

  it('create the three-table relational model', () => {
    const db = memoryDb();
    const tables = db
      .prepare<[], { name: string }>("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((row) => row.name);

    expect(tables).toEqual(expect.arrayContaining(['users', 'hobbies', 'user_hobbies']));
    db.close();
  });

  it('enforce referential integrity on user_hobbies', () => {
    const db = memoryDb();
    expect(() =>
      db.prepare('INSERT INTO user_hobbies (user_id, hobby_id) VALUES (99999, 99999)').run(),
    ).toThrow();
    db.close();
  });
});

describe('seeding', () => {
  it('produces the requested number of users with 0–10 hobbies each', () => {
    const db = memoryDb();
    const result = seedDatabase(db, { userCount: 120, seed: 7, force: true });

    expect(result.users).toBe(120);

    const counts = db
      .prepare<
        [],
        { n: number }
      >('SELECT COUNT(*) AS n FROM user_hobbies GROUP BY user_id ORDER BY n DESC')
      .all();

    expect(counts[0]!.n).toBeLessThanOrEqual(10);
    db.close();
  });

  it('is deterministic — same seed reproduces identical rows and ids', () => {
    const a = memoryDb();
    const b = memoryDb();
    seedDatabase(a, { userCount: 80, seed: 1234, force: true });
    seedDatabase(b, { userCount: 80, seed: 1234, force: true });

    expect(snapshot(b)).toEqual(snapshot(a));
    a.close();
    b.close();
  });

  it('produces different data for a different seed', () => {
    const a = memoryDb();
    const b = memoryDb();
    seedDatabase(a, { userCount: 80, seed: 1, force: true });
    seedDatabase(b, { userCount: 80, seed: 2, force: true });

    expect(snapshot(b)).not.toEqual(snapshot(a));
    a.close();
    b.close();
  });

  it('skips an already-populated database unless forced', () => {
    // This is what makes container restarts cheap and `yarn db:seed` safe to
    // re-run by hand.
    const db = memoryDb();
    seedDatabase(db, { userCount: 50, seed: 9, force: true });

    const again = seedDatabase(db, { userCount: 50, seed: 9 });
    expect(again.skipped).toBe(true);
    expect(db.prepare<[], { n: number }>('SELECT COUNT(*) AS n FROM users').get()!.n).toBe(50);

    db.close();
  });

  it('replaces rather than appends when forced', () => {
    const db = memoryDb();
    seedDatabase(db, { userCount: 50, seed: 9, force: true });
    seedDatabase(db, { userCount: 30, seed: 9, force: true });

    expect(db.prepare<[], { n: number }>('SELECT COUNT(*) AS n FROM users').get()!.n).toBe(30);
    db.close();
  });

  it('generates duplicate full names, which is what exercises the tie-breaker', () => {
    const db = memoryDb();
    seedDatabase(db, { userCount: 300, seed: 4242, force: true });

    const duplicates = db
      .prepare<
        [],
        { n: number }
      >('SELECT COUNT(*) AS n FROM (SELECT first_name, last_name FROM users GROUP BY first_name, last_name HAVING COUNT(*) > 1)')
      .get()!.n;

    expect(duplicates).toBeGreaterThan(0);
    db.close();
  });
});

describe('persistence', () => {
  it('survives closing and reopening the database file', () => {
    // SQLite is the source of truth, so the data must outlive the process —
    // this is the file-backed equivalent of a container restart.
    const file = tempDbPath();

    const first = new Database(file) as Db;
    first.pragma('journal_mode = WAL');
    first.pragma('foreign_keys = ON');
    runMigrations(first);
    seedDatabase(first, { userCount: 60, seed: 31, force: true });
    const before = snapshot(first);
    first.close();

    const second = new Database(file) as Db;
    expect(snapshot(second)).toEqual(before);
    expect(second.prepare<[], { n: number }>('SELECT COUNT(*) AS n FROM users').get()!.n).toBe(60);

    // And the schema ledger came back too, so a reopened database is not
    // re-migrated from scratch.
    expect(runMigrations(second)).toEqual([]);
    second.close();
  });
});
