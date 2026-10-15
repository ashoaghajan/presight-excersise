/**
 * The production connection path, against a real SQLite **file**.
 *
 * Every other suite uses `:memory:` for speed, which skips exactly the code
 * that runs at start-up in production: creating the data directory, opening
 * the file, the pragmas, and migrating before the server listens. A wrong
 * pragma here is silent until it matters (foreign keys are OFF by default in
 * SQLite, so cascades would just stop happening), so each one is asserted.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type DbModule = typeof import('./index');

let dir: string;
let dbPath: string;
let mod: DbModule;

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'presight-db-'));
  // A directory that does not exist yet: getDb must create it.
  dbPath = path.join(dir, 'nested', 'app.sqlite');

  // `config` reads the environment once at import, so the env is set first
  // and the module graph is reloaded for each test.
  vi.stubEnv('DATABASE_PATH', dbPath);
  vi.stubEnv('LOG_LEVEL', 'silent');
  vi.resetModules();
  mod = await import('./index');
});

afterEach(() => {
  mod.closeDb();
  vi.unstubAllEnvs();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('getDb', () => {
  it('creates the data directory and the database file', () => {
    mod.getDb();
    expect(fs.existsSync(dbPath)).toBe(true);
  });

  it('enables WAL, foreign keys and a busy timeout', () => {
    const db = mod.getDb();

    expect(db.pragma('journal_mode', { simple: true })).toBe('wal');
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(db.pragma('busy_timeout', { simple: true })).toBe(5000);
  });

  it('returns one shared connection until it is closed', () => {
    const first = mod.getDb();
    expect(mod.getDb()).toBe(first);

    mod.closeDb();
    expect(first.open).toBe(false);
    expect(mod.getDb()).not.toBe(first);
  });

  it('makes closeDb safe to call twice', () => {
    mod.getDb();
    mod.closeDb();
    expect(() => mod.closeDb()).not.toThrow();
  });
});

describe('initializeDatabase', () => {
  it('applies the migrations before returning', () => {
    const db = mod.initializeDatabase();

    const tables = db
      .prepare<[], { name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => row.name);
    expect(tables).toEqual(expect.arrayContaining(['users', 'hobbies', 'user_hobbies']));

    const applied = db
      .prepare<[], { name: string }>('SELECT name FROM schema_migrations')
      .all()
      .map((row) => row.name);
    expect(applied).toContain('001_init.sql');
  });

  it('is safe on every boot: a second start applies nothing and keeps the data', () => {
    const db = mod.initializeDatabase();
    db.prepare(
      `INSERT INTO users (avatar, first_name, last_name, age, nationality)
       VALUES ('a.svg', 'Ada', 'Lovelace', 36, 'United Kingdom')`,
    ).run();
    mod.closeDb();

    // A restart: new connection, same file.
    const reopened = mod.initializeDatabase();
    const count = reopened.prepare<[], { n: number }>('SELECT COUNT(*) AS n FROM users').get();
    expect(count?.n).toBe(1);
  });

  it('enforces the schema’s foreign keys and cascades', () => {
    // Only true because getDb turns foreign_keys ON; SQLite's default is OFF,
    // in which case the orphan insert below would silently succeed.
    const db = mod.initializeDatabase();
    const userId = Number(
      db
        .prepare(
          `INSERT INTO users (avatar, first_name, last_name, age, nationality)
           VALUES ('a.svg', 'Ada', 'Lovelace', 36, 'United Kingdom')`,
        )
        .run().lastInsertRowid,
    );
    const hobbyId = Number(
      db.prepare(`INSERT INTO hobbies (name) VALUES ('Chess')`).run().lastInsertRowid,
    );
    db.prepare('INSERT INTO user_hobbies (user_id, hobby_id) VALUES (?, ?)').run(userId, hobbyId);

    expect(() =>
      db.prepare('INSERT INTO user_hobbies (user_id, hobby_id) VALUES (?, ?)').run(9999, hobbyId),
    ).toThrow(/FOREIGN KEY/);

    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    const links = db.prepare<[], { n: number }>('SELECT COUNT(*) AS n FROM user_hobbies').get();
    expect(links?.n).toBe(0);
  });
});
