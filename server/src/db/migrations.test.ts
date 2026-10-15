/**
 * Migration 002: the FTS5 name index and the triggers that keep it in sync.
 *
 * An external-content FTS table does not follow its source table by itself.
 * If a trigger is missing or wrong, search silently returns stale results, so
 * every write path is checked here, plus FTS5's own `integrity-check`, which
 * fails if the index disagrees with the `users` rows.
 */

import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

import type { Db } from './index';
import { runMigrations } from './migrator';

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

let db: Db;

afterEach(() => db?.close());

function openMigrated(): Db {
  db = new Database(':memory:') as Db;
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  return db;
}

function insertUser(firstName: string, lastName: string): number {
  return Number(
    db
      .prepare(
        `INSERT INTO users (avatar, first_name, last_name, age, nationality)
         VALUES ('a.svg', ?, ?, 30, 'Testland')`,
      )
      .run(firstName, lastName).lastInsertRowid,
  );
}

/** Ids the FTS index returns for a substring, the way the repository asks. */
function ftsIds(term: string): number[] {
  return db
    .prepare<[string], { rowid: number }>(
      'SELECT rowid FROM users_fts WHERE users_fts MATCH ? ORDER BY rowid',
    )
    .all(`"${term}"`)
    .map((row) => row.rowid);
}

/** Throws if the FTS index does not match the content table exactly. */
function integrityCheck(): void {
  db.exec(`INSERT INTO users_fts (users_fts) VALUES ('integrity-check')`);
}

describe('migration 002 — users_fts', () => {
  it('backfills users that existed before the migration', () => {
    // Simulates an existing production database: schema 001 with data, then
    // the new migration applied on the next deploy.
    db = new Database(':memory:') as Db;
    db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, '001_init.sql'), 'utf8'));
    db.exec(`
      CREATE TABLE schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')));
      INSERT INTO schema_migrations (name) VALUES ('001_init.sql');
    `);
    const id = insertUser('Hannah', 'Okafor');

    expect(runMigrations(db)).toEqual(['002_users_name_fts.sql']);
    expect(ftsIds('ann')).toEqual([id]);
    integrityCheck();
  });

  it('indexes inserted users', () => {
    openMigrated();
    const id = insertUser('Marianne', 'Keller');

    expect(ftsIds('ianne')).toEqual([id]);
    expect(ftsIds('kel')).toEqual([id]);
    integrityCheck();
  });

  it('re-indexes a renamed user and forgets the old name', () => {
    openMigrated();
    const id = insertUser('Oliver', 'Stone');

    db.prepare(`UPDATE users SET last_name = 'Brook' WHERE id = ?`).run(id);

    expect(ftsIds('stone')).toEqual([]);
    expect(ftsIds('brook')).toEqual([id]);
    integrityCheck();
  });

  it('leaves the index alone when a non-name column changes', () => {
    openMigrated();
    const id = insertUser('Oliver', 'Stone');

    db.prepare('UPDATE users SET age = 31, avatar = ? WHERE id = ?').run('b.svg', id);

    expect(ftsIds('oliver')).toEqual([id]);
    integrityCheck();
  });

  it('removes deleted users from the index', () => {
    openMigrated();
    const id = insertUser('Priya', 'Nair');
    insertUser('Priyanka', 'Rao');

    db.prepare('DELETE FROM users WHERE id = ?').run(id);

    expect(ftsIds('priya')).toHaveLength(1);
    expect(ftsIds('nair')).toEqual([]);
    integrityCheck();
  });

  it('is expand-only: the pre-002 LIKE query still works on the migrated schema', () => {
    // What an app version from before this migration runs. If the migration
    // renamed or dropped anything it reads, rolling back the image would
    // break; this pins that it does not.
    openMigrated();
    insertUser('Hannah', 'Okafor');

    const rows = db
      .prepare(`SELECT id FROM users WHERE first_name LIKE '%ann%' OR last_name LIKE '%ann%'`)
      .all();
    expect(rows).toHaveLength(1);
  });

  it('is applied once and recorded', () => {
    openMigrated();
    expect(runMigrations(db)).toEqual([]);

    const names = db
      .prepare<[], { name: string }>('SELECT name FROM schema_migrations ORDER BY name')
      .all()
      .map((row) => row.name);
    expect(names).toEqual(['001_init.sql', '002_users_name_fts.sql']);
  });
});
