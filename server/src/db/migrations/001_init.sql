-- 001_init — base schema for the user directory.
--
-- Hobbies are modelled as a proper many-to-many relation instead of a JSON/CSV
-- column so that "users having ALL of the selected hobbies" and the sidebar's
-- per-hobby counts can be expressed in SQL and served by indexes:
--
--   AND-filter:  JOIN user_hobbies + GROUP BY u.id
--                HAVING COUNT(DISTINCT h.name) = :selectedHobbyCount
--   facets:      GROUP BY h.name over the same filtered set
--
-- COLLATE NOCASE on the text columns is a deliberate schema-level decision
-- rather than something each query repeats. It makes `=`, `LIKE`, ORDER BY and
-- the indexes below all case-insensitive by default, which is what a name
-- directory wants: `?nationalities=uae` matches "UAE", and "alice" sorts next
-- to "Alice" instead of after "Zoe". Getting this wrong per-query is a silent
-- bug; getting it right once in the DDL is not.
--
-- Caveat: SQLite's built-in NOCASE folds ASCII only, so "Müller" will not match
-- a search for "muller". If diacritic-insensitive search is ever required, add
-- a normalised `search_text` column plus an index on it rather than trying to
-- fix it in the WHERE clause.

CREATE TABLE IF NOT EXISTS users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  avatar      TEXT    NOT NULL,
  first_name  TEXT    NOT NULL COLLATE NOCASE,
  last_name   TEXT    NOT NULL COLLATE NOCASE,
  age         INTEGER NOT NULL,
  nationality TEXT    NOT NULL COLLATE NOCASE
);

CREATE TABLE IF NOT EXISTS hobbies (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT    NOT NULL COLLATE NOCASE UNIQUE
);

CREATE TABLE IF NOT EXISTS user_hobbies (
  user_id  INTEGER NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  hobby_id INTEGER NOT NULL REFERENCES hobbies(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, hobby_id)
);

-- Sort indexes. Each one ends with `id` because every ORDER BY carries `id` as
-- its final tie-breaker, so a single index can satisfy the whole ordering and
-- pagination stays stable (no duplicated or skipped rows between pages).
--
-- The name indexes do double duty: inheriting NOCASE from the column, they also
-- serve case-insensitive prefix search (`LIKE 'ali%'`). A substring search
-- (`LIKE '%ali%'`) cannot use any B-tree index and falls back to a scan — at a
-- few thousand rows that is sub-millisecond, and FTS5 is the escape hatch if
-- the dataset ever grows past that.
-- `idx_users_nationality` does double duty again: it is both the sort index and
-- the lookup for the nationality OR-filter (`WHERE nationality IN (...)`).
CREATE INDEX IF NOT EXISTS idx_users_first_name  ON users (first_name, id);
CREATE INDEX IF NOT EXISTS idx_users_last_name   ON users (last_name, id);
CREATE INDEX IF NOT EXISTS idx_users_age         ON users (age, id);
CREATE INDEX IF NOT EXISTS idx_users_nationality ON users (nationality, id);

-- Two known limits of this index set, measured with EXPLAIN QUERY PLAN and
-- accepted deliberately rather than papered over with more indexes:
--
--  * `ORDER BY <field> DESC, id ASC` walks the index backwards, which yields
--    `id DESC` within a tie group, so SQLite adds a temp B-tree for the last
--    ORDER BY term. Fixing it properly needs a mirrored `(field DESC, id ASC)`
--    index per sortable field — eight indexes to save microseconds on a few
--    thousand rows. Add them only if the dataset grows by orders of magnitude.
--
--  * A multi-value `nationality IN (...)` cannot produce globally sorted output
--    from one index, so filtered+sorted pages also use a temp B-tree. Same
--    verdict: correct, bounded, and not worth denormalising for at this size.

-- Reverse lookup for the join table: `user_hobbies` is keyed by (user_id,
-- hobby_id), which cannot answer "which users have hobby X". Covering the pair
-- in both directions keeps the AND-filter and the facet counts index-only.
CREATE INDEX IF NOT EXISTS idx_user_hobbies_hobby ON user_hobbies (hobby_id, user_id);
