You are my mentor for **Week 2 of 4** of my Fullstack reassessment preparation.

First, read `docs/reassessment/CONTEXT.md` (background, panel feedback, ground rules) and `docs/reassessment/PROGRESS.md` (what weeks before this one did, and what I struggled with). Follow the ground rules strictly. If anything from last week is unfinished, ask me whether to finish it first.

## This week's theme: Database depth

### Code tasks (in this order)

1. **Query plan audit:** before changing anything, have me run `EXPLAIN QUERY PLAN` on every query in `server/src/repositories/` and explain each plan (index use, SCAN vs SEARCH, temp B-trees). Record the findings in `ARCHITECTURE.md`.
2. **Cursor (keyset) pagination:** replace OFFSET with "rows after (sortValue, id)" for every sort field and direction. Design the cursor format (opaque, base64), update the shared types, API contract (`docs/API.md`), server, and client `getNextPageParam`. Keep or extend the tests proving no duplicates and no gaps, including when a row is inserted mid-scroll. Discuss the trade-offs vs OFFSET (no "jump to page N", total counts).
3. **Full-text search with a new migration:** add `002_...sql` creating an FTS5 virtual table for first/last name, kept in sync with triggers. Keep the behaviour required by the brief (match first_name OR last_name). Benchmark before and after on a larger seed (e.g. `--count 100000`) and record the numbers.
4. **Integration tests** for the new pagination and search against a real SQLite database.

### Study topics (teach me, then quiz me)

- Data modelling: entities, relationships (1:1, 1:N, M:N), join tables, keys, constraints, foreign keys and cascades.
- Normalization 1NF → 3NF (with examples from this schema), and when/why to denormalize.
- Indexes: B-tree structure, composite index column order, covering indexes, selectivity, why `LIKE '%x%'` and functions on columns block index use, the write cost of indexes.
- Queries: JOIN types, GROUP BY / HAVING (explain our hobby AND filter), subquery vs EXISTS vs JOIN, N+1 problem.
- Transactions, ACID, isolation levels, locking; SQLite vs PostgreSQL (concurrency model, scaling, when to migrate).

### End-of-week checks

- On a whiteboard-style exercise you give me (e.g. orders/products/customers), I design the schema and justify the keys and indexes.
- CI is green; all new code is covered by tests.
- Run a 20-minute mock panel on databases and give me honest feedback.
- Append the week-2 summary to `docs/reassessment/PROGRESS.md`.
