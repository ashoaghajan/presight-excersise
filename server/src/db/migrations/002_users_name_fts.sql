-- 002_users_name_fts — full-text index for the name search.
--
-- `LIKE '%term%'` has a leading wildcard, so no B-tree index can serve it and
-- every search scans all users (see ARCHITECTURE.md §3.4.1). This adds an FTS5
-- index over first_name / last_name that the search can query instead.
--
-- Tokenizer: `trigram`. The search is a *substring* match ("ann" finds
-- "Hannah"). The default tokenizer splits text into words and can only match
-- whole words or word prefixes, which would silently change that behaviour.
-- `trigram` indexes every 3-character sequence, so any substring of 3+
-- characters is an index lookup. It is case-insensitive by default, matching
-- the NOCASE columns. Terms shorter than 3 characters cannot be looked up this
-- way; the repository keeps the LIKE scan for those.
--
-- External content (`content='users'`): the FTS table stores only the index,
-- not a second copy of the names; it reads the text from `users` by rowid.
-- The cost is that SQLite does not keep it in sync on its own — the three
-- triggers below do. Keeping them in the database rather than in application
-- code means every writer (the seeder, an admin script, an older app version)
-- updates the index, not just the code paths that remember to.
--
-- Backward compatible (expand only): this migration adds a table and triggers
-- and changes nothing that existing code reads. An app version from before it
-- keeps working against the migrated database, and its writes still reach the
-- index through the triggers, so rolling back the image is safe and needs no
-- down migration. There is no "contract" step: nothing is removed.

CREATE VIRTUAL TABLE IF NOT EXISTS users_fts USING fts5(
  first_name,
  last_name,
  content = 'users',
  content_rowid = 'id',
  tokenize = 'trigram'
);

-- External-content FTS5 tables are updated by writing the *old* values with
-- the special 'delete' command, then the new values. Passing old.* matters:
-- FTS5 removes exactly the tokens it is given.
CREATE TRIGGER IF NOT EXISTS users_fts_after_insert AFTER INSERT ON users BEGIN
  INSERT INTO users_fts (rowid, first_name, last_name)
  VALUES (new.id, new.first_name, new.last_name);
END;

CREATE TRIGGER IF NOT EXISTS users_fts_after_delete AFTER DELETE ON users BEGIN
  INSERT INTO users_fts (users_fts, rowid, first_name, last_name)
  VALUES ('delete', old.id, old.first_name, old.last_name);
END;

-- Only fires when a name column changes; an age or avatar update does not
-- touch the index.
CREATE TRIGGER IF NOT EXISTS users_fts_after_update
AFTER UPDATE OF first_name, last_name ON users BEGIN
  INSERT INTO users_fts (users_fts, rowid, first_name, last_name)
  VALUES ('delete', old.id, old.first_name, old.last_name);
  INSERT INTO users_fts (rowid, first_name, last_name)
  VALUES (new.id, new.first_name, new.last_name);
END;

-- Backfill: index the rows that existed before this migration. Runs inside
-- the migrator's transaction, so readers see either no index or a complete
-- one.
INSERT INTO users_fts (users_fts) VALUES ('rebuild');
