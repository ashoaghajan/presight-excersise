# Architecture

This document describes how the User Directory monorepo is laid out, why it is
laid out that way, and what each layer is allowed to do.

Setup and run instructions are in [`README.md`](README.md); the wire contract
for the single endpoint is in [`docs/API.md`](docs/API.md).

---

## 1. Repository layout

```
presight-execise/
├── shared/                 @presight/shared — the HTTP contract, shared by both sides
│   └── src/
│       ├── api/            users.ts, pagination.ts, facets.ts, errors.ts
│       ├── sorting.ts      SORT_FIELDS / SORT_DIRECTIONS + tie-breaker rule
│       └── index.ts
│
├── server/                 presight-server — Node + Express + SQLite
│   ├── src/
│   │   ├── index.ts        composition root: builds repos → service → app → listen
│   │   ├── app.ts          Express assembly (middleware order); never binds a port
│   │   ├── config/         env parsing/validation; the only reader of process.env
│   │   ├── db/             connection + init, migrator, migrations/*.sql, seed/
│   │   ├── repositories/   SQL only
│   │   ├── services/       business logic / orchestration
│   │   ├── routes/         route table: method + path → controller method
│   │   ├── controllers/    HTTP handling (+ controllers/validators/ = trust boundary)
│   │   ├── middleware/     cors/logging/404/error envelope
│   │   ├── lib/            HttpError, logger
│   │   └── types/          persistence-shaped row types
│   ├── data/               SQLite file lives here (gitignored)
│   └── Dockerfile
│
├── client/                 presight-client — React + Vite + Tailwind
│   ├── src/
│   │   ├── main.tsx        mounts <App />
│   │   ├── app/            providers, router, query client — composition layer
│   │   ├── pages/          screen-level composition only
│   │   ├── features/       users | filters | sorting (vertical slices)
│   │   ├── shared/         api (axios), store (zustand), config, ui, hooks, lib
│   │   └── styles/         Tailwind entry + design tokens (@theme)
│   ├── nginx.conf          static hosting + /api proxy for the container
│   └── Dockerfile
│
├── docs/API.md             request/response contract for GET /api/users
├── e2e/                    Playwright layout / state / filter / URL checks
├── tsconfig.base.json      one strictness policy for every workspace
├── docker-compose.yml
└── ARCHITECTURE.md
```

---

## 2. Cross-cutting decisions

### 2.1 TypeScript everywhere, one strictness policy

`tsconfig.base.json` holds the shared compiler options (`strict`,
`noUncheckedIndexedAccess`, `isolatedModules`, …); each workspace extends it and
overrides only environment-specific settings (`module`, `jsx`, `lib`, `outDir`).
Strictness is set once, up front, because retro-fitting it onto a finished
codebase is far more expensive than starting with it.

`noUnusedLocals`/`noUnusedParameters` are **on**. They were off only while the
repository was a scaffold of intentionally unused placeholders; with every layer
implemented they now hold, and they are what keeps dead code from accumulating
quietly.

### 2.2 A shared contract package

`@presight/shared` is the single source of truth for everything that crosses the
wire: `UserDto`, `UsersQuery`, `UsersResponse`, `PaginationMeta`, `FacetCount`,
`ApiErrorBody`, and the sort vocabulary.

Why a third workspace rather than duplicating types:

- the client's URL codec, the server's query validator and the SQL `ORDER BY`
  whitelist must all agree on the same four sort fields — sharing the constant
  makes disagreement impossible;
- changing a response field becomes a compile error on both sides instead of a
  runtime surprise;
- it contains **no** logic and **no** environment-specific code, so it stays
  cheap to build and impossible to misuse.

It compiles to CommonJS so the Node server can run the emitted JS directly while
Vite pre-bundles the same artefact for the browser — one output format, no
dual-package hazard.

### 2.3 Monorepo tooling

Yarn 1 workspaces (already in place) plus Lerna for topologically ordered task
running: `yarn build` builds `shared` before `server` and `client`, which is
required because both type-check against `shared/dist`.

The root `resolutions` block pins `@types/node` and `tinyglobby` across the
tree. Lerna pulls in different versions of both, which made Yarn install a
**second physical copy of Vite** inside `client/node_modules`; TypeScript then
saw two incompatible identities for every Vite type and `vite.config.ts` failed
to compile. The pin keeps a single copy of each.

---

## 3. Backend architecture

### 3.1 Layers

Requests flow strictly downwards, and each layer may only import the one below:

```
route  →  controller  →  service  →  repository  →  SQLite
  ↑          ↑              ↑             ↑
  │          │              │             └── SQL lives here, and nowhere else
  │          │              └── business rules; knows nothing about Express or SQL
  │          └── HTTP only: parse/validate request → call service → shape response
  └── maps method + path onto a controller method, nothing else
```

| Layer           | Owns                                                    | Must never                                     |
| --------------- | ------------------------------------------------------- | ---------------------------------------------- |
| `routes/`       | URL shape: which method + path reaches which controller | contain handler logic                          |
| `controllers/`  | query validation, status codes, JSON serialisation      | contain SQL or business rules                  |
| `services/`     | orchestration, pagination maths, row → DTO mapping      | import `express` or touch the DB               |
| `repositories/` | SQL construction, prepared statements, row typing       | know about HTTP or apply defaults              |
| `db/`           | connection lifecycle, migrations, seeding               | be imported by services or routes              |
| `middleware/`   | cross-cutting HTTP concerns                             | know about users, hobbies or nationalities     |
| `config/`       | reading and validating `process.env`                    | be bypassed (nothing else reads `process.env`) |

The payoff is testability: a controller can be unit-tested with a fake service,
a service with fake repositories,
a repository against an in-memory SQLite database, and the whole app by binding
it to an ephemeral port — none of them require the others.

### 3.2 Composition root

`src/index.ts` is the **only** module that names concrete implementations. It
constructs the repositories, injects them into the service, injects the service
into `createApp()`, and starts listening. Everything else depends on the
exported interfaces (`UserRepository`, `FacetRepository`, `UserService`), which
is what makes substitution in tests a one-line change.

`app.ts` is separate from `index.ts` on purpose: it builds an Express app and
returns it but never binds a port, so the HTTP surface is testable without
process-level side effects.

### 3.3 Persistence

**better-sqlite3, synchronous.** SQLite reads come from a local file in
microseconds; an async driver would add a thread-pool hop and force `await`
through every layer for no benefit. One process-wide connection is correct —
SQLite serialises writes internally, and a single connection lets prepared
statements be cached. `WAL` mode is enabled so readers are not blocked by the
seeder, and `foreign_keys = ON` because SQLite disables them by default.

**Schema** (`db/migrations/001_init.sql`) uses a proper many-to-many relation
(`users`, `hobbies`, `user_hobbies`) rather than a JSON/CSV hobby column,
because two required behaviours are only expressible (and indexable) relationally:

- "users having **all** selected hobbies" (`GROUP BY … HAVING COUNT(DISTINCT …)`),
- per-hobby counts for the sidebar.

`first_name`, `last_name`, `nationality` and `hobbies.name` are declared
`COLLATE NOCASE`. Putting the collation in the DDL rather than in each query
makes `=`, `LIKE`, `ORDER BY` and every index case-insensitive by default, which
is what a name directory wants (`?nationalities=uae` matches `UAE`; `alice`
sorts beside `Alice`). SQLite's NOCASE folds ASCII only — diacritic-insensitive
search would need a normalised `search_text` column, noted in the migration.

Every sort index ends in `id` (`(first_name, id)`, `(age, id)`, …) to match the
mandatory `ORDER BY <field>, id ASC`, so one index can satisfy the entire
ordering; the name indexes additionally serve case-insensitive prefix search.
Two limits were measured with `EXPLAIN QUERY PLAN` and accepted rather than
indexed away — `DESC` sorts and multi-value `nationality IN (…)` both add a temp
B-tree for the tie-breaker. Both cost microseconds at this size; the migration
records what to add if that ever changes.

**Migrations** are plain `.sql` files applied in filename order and recorded in
`schema_migrations`, each inside a transaction. A reviewer can read the DDL
without learning a migration DSL. `tsc` does not copy `.sql` files, so the
server's `build` script copies `src/db/migrations` into `dist/db/migrations`.

`migrator.ts` holds the engine and is free of process concerns, so all three
callers share it: the `db:migrate` CLI, the seeder (which must never run against
a stale schema), and `initializeDatabase()` at server start-up. A process that
would serve requests against a missing schema never gets as far as listening.
Seeding is deliberately _not_ part of start-up — inserting demo rows is an
explicit operator action, not a side effect of booting.

**Full-text search** (`002_users_name_fts.sql`). `LIKE '%term%'` has a leading
wildcard, so no B-tree can serve it and every search scanned all users. Migration
002 adds an FTS5 virtual table over `first_name`/`last_name` with the **trigram**
tokenizer, and the filter asks it for matching ids:

```sql
u.id IN (SELECT rowid FROM users_fts WHERE users_fts MATCH '"ann"')
```

- _Trigram, not the default tokenizer._ The search is a substring match ("ann"
  finds "Hannah"). The default `unicode61` tokenizer matches whole words or word
  prefixes only, which would quietly change behaviour. Trigram indexes every
  3-character sequence, so any substring of 3+ characters is an index lookup.
  Terms of 1–2 characters cannot form a trigram and keep the `LIKE` scan.
- _The term is one quoted phrase._ Inside quotes, FTS5 operators (`OR`, `NEAR`,
  `*`, `:`) are plain text, so typing them cannot change the query or cause a
  syntax error. Without the quotes, a stray `"` in the search box was a 500.
- _External content + triggers._ `content='users'` stores only the index, not a
  second copy of the names. SQLite does not sync it automatically, so insert,
  delete and name-update triggers do. They live in the database rather than the
  app, so every writer (seeder, scripts, an older app version) keeps the index
  correct. Tests run FTS5's `integrity-check` after each kind of write.
- _Expand-only, so rollback is safe._ The migration adds a table and triggers
  and changes nothing existing code reads. The previous image still works on
  the migrated database, and its writes still reach the index through the
  triggers. No down migration and no contract step are needed.

Measured on 100k users (one full request: count + page + both facets; mean of
20; the facet queries are the remaining cost for common terms):

| Search         | Matches | Before (`LIKE`) |       After (FTS5) |
| -------------- | ------: | --------------: | -----------------: |
| `ann`          |     746 |          138 ms |             2.9 ms |
| `shehri`       |     406 |          118 ms |             2.8 ms |
| `mar`          |   6,475 |          161 ms |              27 ms |
| `zzzz` (none)  |       0 |          245 ms |             0.3 ms |
| `al` (2 chars) |  23,522 |          163 ms | unchanged (`LIKE`) |

The price is paid on writes and disk: seeding 100k users went from ~4.2 s to
~8.3 s, because each insert now also writes one index entry per trigram of
both names, and the file grew from 35 MB to 40 MB. The backfill of 100k
existing rows took ~150 ms inside the migration's transaction. For a read-heavy
directory that trade is clearly worth it; for a write-heavy table it would need
measuring.

**Seeding** (`db/seed/`) generates 1200 users across 24 weighted nationalities
and 44 weighted hobbies, 0–10 hobbies per user. Three properties are deliberate:

- _Names are tied to nationality_ — each nationality carries its own name pools,
  so the directory looks plausible rather than randomly shuffled.
- _Everything is weighted_ — uniform distributions would give every nationality
  and hobby near-identical counts, which makes the sidebar's top-20 ordering
  meaningless and hides bugs in facet counting.
- _Pools are small enough to repeat_ — duplicate full names occur on purpose, as
  they are what actually exercises the mandatory `id` tie-breaker.

Repeatability comes from a seeded PRNG (`mulberry32`, never `Math.random()`)
plus truncating the AUTOINCREMENT counters before insert, so the same `--seed`
reproduces identical rows _with identical ids_. Re-running without `--force`
skips an already-populated database, which keeps container restarts cheap. The
whole seed runs in one transaction — otherwise ~5000 inserts become ~5000
fsyncs — and finishes with `ANALYZE` so the first real query is not planned
against empty-table statistics.

### 3.4 The repository layer

Four methods across two repositories:

| Method                                | Returns                                                |
| ------------------------------------- | ------------------------------------------------------ |
| `UserRepository.searchUsers`          | one ordered page of users, with their hobbies          |
| `UserRepository.countUsers`           | total matching the same filters, ignoring paging       |
| `FacetRepository.getTopHobbies`       | `{ value, count }[]` over the same filtered set        |
| `FacetRepository.getTopNationalities` | `{ value, count }[]`, minus its own filter — see below |

All four derive their WHERE clause from **one** function, `buildUserFilter`
(`repositories/user-filter.ts`). This is the load-bearing decision of the layer:
if the page query and the count query build predicates independently they will
drift, and the UI ends up reporting "312 results" while scrolling a different
set. Build once, reuse four times.

**Disjunctive faceting for nationality.** `buildUserFilter` takes an optional
`exclude` dimension, and the nationality facets pass `exclude: 'nationalities'`.
The reason is structural rather than cosmetic: a user holds exactly **one**
nationality, so counting nationalities over a nationality-filtered set can only
return the selected values. Selecting "India" made the facet list `[India]`,
every other checkbox disappeared, and the OR filter became impossible to give a
second value — the multi-select would be unreachable by construction.

Search and hobbies still apply, so the counts remain scoped to the query; only
the facet's own dimension is dropped. With India selected, "Japan (57)" means
"adding Japan brings in 57 more users", which is exactly what OR promises.

Hobbies deliberately keep the full predicate. A user has up to ten, so a
hobby-filtered set still contains plenty of other hobbies, and each addition
narrowing the list is the correct reading of AND. Excluding the hobby filter
there would advertise counts the AND semantics will not deliver.

**Nationality is OR; hobby is AND**, and the asymmetry is structural rather than
a choice of operator. A user row holds exactly one nationality, so the selected
values are alternatives for a single column — `u.nationality IN (…)` _is_ a chain
of ORs, and SQLite drives it from `idx_users_nationality`. Hobbies live one row
per (user, hobby), so "has both" cannot be a condition on any single row; a plain
`h.name IN (…)` join would return anyone with _at least one_ match, which is
exactly the OR semantics we must avoid. Instead the filter uses one uncorrelated
subquery that groups the link table by user and keeps only users whose distinct
match count equals the number of hobbies requested:

```sql
u.id IN (SELECT uh.user_id FROM user_hobbies uh JOIN hobbies h ON h.id = uh.hobby_id
          WHERE h.name IN (?, ?) GROUP BY uh.user_id
         HAVING COUNT(DISTINCT uh.hobby_id) = ?)
```

Written as a subquery rather than N correlated `EXISTS` clauses so that it is
evaluated once, and — more importantly — so the outer query stays a plain row
filter with **no GROUP BY**. That is what lets `ORDER BY`/`LIMIT` and the cursor keep
using the sort indexes, and what lets the identical predicate drop unchanged into
the two facet queries.

**Injection surface.** Every caller-supplied value binds through a `?`
placeholder; only placeholder _counts_ are generated from input length. The one
thing that must reach the SQL text is the ORDER BY column, because SQLite binds
values but not identifiers — so it is resolved through a fixed `SORT_FIELDS →
column` lookup table that cannot emit anything but a constant. LIKE wildcards in
the search term are escaped (with a matching `ESCAPE '\'`), otherwise typing `%`
would match every row.

**Determinism.** `buildOrderBy` appends `u.id ASC` unconditionally. Without it,
rows with equal sort values may come back in any order and consecutive pages can
duplicate or skip users mid-scroll.

Measured on the seeded 1200 rows with all three filters active: `searchUsers`
0.32 ms, `countUsers` 0.13 ms, `getTopHobbies` 0.28 ms, `getTopNationalities`
0.14 ms per call. Prepared statements are cached by SQL text
(`repositories/statement-cache.ts`) because the SQL shape is generated per
request but repeats constantly while a user scrolls.

### 3.4.1 Query plan audit

Every repository query was run through `EXPLAIN QUERY PLAN` on the default
seed (1,200 users) and on `db:seed --users=100000` (407k hobby links). The
plans were **identical at both sizes**, so the numbers below show how each plan
scales rather than a different plan being chosen. Timings are the mean of 20
runs of a prepared statement (better-sqlite3, Apple Silicon laptop).

How to read the plan: `SCAN` visits every row of a table or index; `SEARCH`
seeks into a B-tree and reads only a key range; `COVERING INDEX` means the
index alone answers the query and the table is never read; `USE TEMP B-TREE`
means SQLite sorted or grouped rows itself because no index produced them in
the needed order.

| #   | Query                                 | Plan                                                                                                                        | 1.2k     | 100k    |
| --- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------- | ------- |
| 1   | Page, no filter, `first_name ASC`     | `SCAN u USING INDEX idx_users_first_name`                                                                                   | 0.03 ms  | 0.03 ms |
| 1b  | Same, `OFFSET` at 90 % of the table   | same plan                                                                                                                   | 0.04 ms  | 1.08 ms |
| 2   | Page, no filter, `age DESC`           | `SCAN … idx_users_age` + `TEMP B-TREE FOR RIGHT PART OF ORDER BY`                                                           | 0.04 ms  | 0.18 ms |
| 3   | Page, search `ann`, `last_name ASC`   | `SCAN u USING INDEX idx_users_last_name` (LIKE checked per row)                                                             | 0.27 ms  | 9.4 ms  |
| 4   | Page, `nationality IN (2)`, `age ASC` | `SEARCH … idx_users_nationality (nationality=?)` + `TEMP B-TREE FOR ORDER BY`                                               | 0.09 ms  | 2.8 ms  |
| 5   | Page, hobbies `Reading AND Swimming`  | `LIST SUBQUERY` (covering index seeks, temp B-trees for GROUP BY/DISTINCT), then rowid lookups + `TEMP B-TREE FOR ORDER BY` | 0.15 ms  | 10.9 ms |
| 6   | `COUNT(*)`, no filter                 | `SCAN u USING COVERING INDEX idx_users_age`                                                                                 | <0.01 ms | 0.02 ms |
| 7   | `COUNT(*)`, search `ann`              | `SCAN u` (full table)                                                                                                       | 0.14 ms  | 11.8 ms |
| 8   | `loadHobbies` for one page            | `SEARCH uh USING COVERING INDEX (user_id=?)` + PK lookup on `hobbies`                                                       | 0.13 ms  | 0.15 ms |
| 9   | Top nationalities, no filter          | `SCAN u USING COVERING INDEX idx_users_nationality` + `TEMP B-TREE FOR ORDER BY`                                            | 0.05 ms  | 3.6 ms  |
| 10  | Top hobbies, no filter                | `SCAN h` → `SEARCH uh (hobby_id=?)` → `SEARCH u (rowid=?)` + temp B-trees for `count(DISTINCT)` and ORDER BY                | 0.90 ms  | 125 ms  |

**Findings.**

- **Q1 `SCAN` is not a problem.** The index is already in `ORDER BY` order, so
  SQLite reads it from the start and stops after `LIMIT` rows. A SCAN with a
  LIMIT and no sort step is the best plan for an unfiltered page.
- **`OFFSET` is linear (Q1b).** The same plan gets ~36× slower deep in the
  list, because SQLite still walks and discards every skipped row. This is the
  case for keyset (cursor) pagination.
- **`DESC` adds a sort on the tie-breaker (Q2).** Walking `(age, id)` backwards
  gives `id DESC` inside a tie group, but we ask for `id ASC`. The temp B-tree
  only re-sorts within each run of equal ages, so it stays cheap.
- **Substring search can't use an index (Q3, Q7).** `LIKE '%ann%'` has a leading
  wildcard, so no B-tree prefix exists to seek on: every row is tested. The page
  query (Q3) can stop once it has 50 matches; the count (Q7) cannot, and runs
  on every request. This is the case for FTS5.
- **Filter + sort on different columns needs a sort (Q4, Q5).** The filter picks
  rows through one index, but the order comes from another column, so all
  matching rows are sorted before `LIMIT` applies.
- **Q8 (`loadHobbies`) is the N+1 fix working.** One query for the whole page,
  both sides served by index seeks, so it costs the same at 1.2k and 100k.
- **The facets are the real cost (Q10).** Top hobbies runs on _every_ request
  and touches all 407k link rows. Two measured improvements, not yet applied:
  `COUNT(*)` instead of `COUNT(DISTINCT u.id)` (safe because the primary key on
  `user_hobbies` makes each (user, hobby) pair unique) brings it to 89 ms, and
  skipping the `users` join when no user-level filter is active brings it to
  15 ms. Caching facet counts per filter, or computing them only on the first
  page, would remove most of the cost. Keyset pagination does not help here.

### 3.5 The API surface

A single endpoint, `GET /api/users`, returns the page **and** the facet counts.
They are not split into two endpoints because both must describe the same
filtered set — separate requests can interleave and leave the sidebar showing
counts that contradict the visible rows.

**Keyset (cursor) pagination.** The response carries an opaque `nextCursor`;
the client sends it back as `?cursor=` and gets the rows that sort after the
last row it already has. The cursor is base64url JSON
`{ v, f: sortField, d: direction, k: sortValue, id }` (`server/src/lib/cursor.ts`).
The controller decodes it at the trust boundary, so a tampered cursor or one
issued for a different sort is a `400`, and the repository turns it into

```sql
-- ORDER BY col ASC, id ASC                -- ORDER BY col DESC, id ASC
col >= ? AND (col > ? OR u.id > ?)         col <= ? AND (col < ? OR u.id > ?)
```

The `id` comparison stays `>` in both directions because the tie-breaker is
always ascending, which is also why SQLite's row-value form `(col, id) > (?, ?)`
cannot be used. The leading `col >= ?` is not redundant: it is a range the
planner can seek to in the `(col, id)` index. Measured at 100k users, the same
deep position costs 0.08 ms in this form and 1.4 ms written as a plain OR,
against 2.0 ms for the `OFFSET` it replaces and 0.07 ms for the first page.

This replaced `page`/`OFFSET` pagination for two reasons. First, `OFFSET` reads
and discards every skipped row, so cost grows with depth (§3.4.1). Second, it is
only correct while the data is static: a row inserted before the reader's
position pushes an already-seen row onto the next page (a duplicate), and a
delete pulls an unseen one back (a gap). A cursor names an exact row, so other
writes cannot move it. The costs are that there is no "jump to page N" and no
`totalPages`, and that a cursor is only valid for the sort it was issued under;
an infinite-scroll list needs neither.

`hasMore` is decided by fetching `limit + 1` rows: the extra row is a probe that
is never returned. It is exact even when the last page is exactly full, and it
does not depend on `total`, which is a separate query. `total` is still computed
for the result count. The retired `page` parameter is rejected with a `400`
rather than ignored, so a browser tab running the old client fails visibly
instead of re-reading page 1 forever.

The response is `{ users, pagination, hobbies, nationalities }`. The two facet
arrays are named for what the sidebar renders; they are counts over the current
result set, never a user's own hobbies. **See [`docs/API.md`](docs/API.md) for
the full request/response contract.**

The route layer stays three lines — validate, call the service, serialise — and
catches nothing: `parseUsersQuery` throws `HttpError`, Express 5 forwards both
that and any unexpected throw to the error middleware, so exactly one place
decides what an error looks like on the wire.

### 3.6 Errors

Layers below the routes throw; `middleware/error-handler.ts` is the single place
that maps a throw onto a status code and the `ApiErrorBody` envelope. The 404
handler funnels unmatched routes into the same envelope, so the client has
exactly one error-parsing path. Internal error messages are suppressed in
production and surfaced in development.

### 3.7 Validation as a trust boundary

`controllers/validators/users.query.ts` is where untrusted query strings become a
typed `UsersQuery`. Because validation happens there and only there, the service
and the repositories may assume valid, normalised, defaulted values and never
re-check them.

The policy is **absent means default, present-but-invalid means 400**. Silent
coercion was rejected deliberately: a shared URL with a typo'd `sortField` that
quietly renders different data is worse than one that says which parameter is
wrong. Zod's field errors are passed straight into `ApiErrorBody.details`, so a
request with three bad parameters reports all three at once.

Every bound is enforced here rather than downstream: `limit` ≤ `MAX_PAGE_SIZE`
(an unbounded limit is a trivial DoS against a virtualized list), ≤ 50 values per
filter (each becomes a bound parameter in an `IN (…)` list), ≤ 100 search
characters, and an encoded `cursor` ≤ 512 characters. Sort parameters are checked
against `SORT_FIELDS`/`SORT_DIRECTIONS` from `@presight/shared` — the same
constants the repository's ORDER BY lookup and the client's sort control use, so
the three cannot disagree.

---

## 4. Frontend architecture

### 4.1 Layers

```
app/      composition: providers, router, query client
 └── pages/     screen layout; composes features, owns the URL-synced query state
      └── features/   users | filters | sorting  (vertical slices)
           └── shared/     http client, config, ui primitives, hooks, lib
```

Each feature has the same internal shape, which is what enforces the
"strict separation between UI and API access" the plan asks for:

| Folder        | Contains                                                  |
| ------------- | --------------------------------------------------------- |
| `api/`        | typed calls on top of `shared/api/http-client`; no React  |
| `model/`      | types, URL/query codecs, pure helpers; no React, no JSX   |
| `hooks/`      | React state and data hooks — the bridge from `api/` to UI |
| `components/` | presentational components; no `fetch`, no route knowledge |

**Dependency rules**

- `components/ → hooks/ → api/ → shared/api`, never the reverse.
- A feature may import `shared/`. **A feature must not import another feature** —
  cross-feature composition happens in `pages/`, and anything genuinely common
  is promoted into `shared/`.
- Only `pages/` and `app/` import features.

### 4.2 State strategy — three stores, no overlap

The single most important frontend decision: **every piece of state has exactly
one home**, chosen by how long it must live and who must see it.

| Kind                 | Lives in             | Why                                                     |
| -------------------- | -------------------- | ------------------------------------------------------- |
| Server data          | TanStack Query       | it is a cache of something the server owns              |
| Shareable view state | the URL              | must survive reload, deep-link and back/forward         |
| Ephemeral UI state   | Zustand (`ui-store`) | dies with the session, but crosses component boundaries |

The rule of thumb, written at the top of `shared/store/ui-store.ts`: if a value
should survive a reload or appear in a shared link it goes in the URL; if a
component tree needs it and it dies with the session it goes in Zustand; if it
came from the API it stays in Query — and it is never copied between them.

**Query state → the URL.** Search text, selected hobbies and nationalities, sort
field and direction are one object, and that object is exactly the argument to
`GET /api/users`. There is **no local mirror**, so there is nothing to keep in
sync and nothing that can drift.

Three modules, each with one job:

| Module                        | Role                                           |
| ----------------------------- | ---------------------------------------------- |
| `model/users-query.ts`        | pure codec: `URLSearchParams` ⇄ typed state    |
| `shared/hooks/useUrlState.ts` | generic, feature-agnostic URL-as-state binding |
| `hooks/useUsersQueryState.ts` | typed binding + history semantics for users    |

`useUrlState` is deliberately generic — it takes a `{ parse, serialize }` codec
and knows nothing about hobbies or sorting — so a second URL-synced screen
reuses it rather than re-deriving the tricky parts (memoising on the query
_string_ rather than the `URLSearchParams` instance, and using the functional
`setSearchParams` form so two updates in one tick cannot clobber each other).

**History semantics are per-interaction, not global.** An earlier draft used
`replace: true` for every update, which silently broke Back — it produced no
history entries at all, so Back skipped the whole session. The fix is to make
intent explicit: `useUrlState` takes a `HistoryMode` per call, and
`useUsersQueryState` exposes _intent-named_ actions rather than one generic
setter.

| Action                              | History   | Why                              |
| ----------------------------------- | --------- | -------------------------------- |
| `toggleHobby` / `toggleNationality` | push      | discrete; Back should untick it  |
| `setSort`                           | push      | discrete; Back should restore it |
| `reset`                             | push      | Back should undo "clear all"     |
| `setSearch`                         | coalesced | continuous — see below           |

`setSearch` pushes when a search _starts_ (empty → text) or is _cleared_
(text → empty), and replaces while an existing term is refined. So Back returns
to the unfiltered list in one step instead of crawling backwards through
half-typed words.

Two deliberate details:

- The pagination cursor is **not** in the URL. The list is an infinite scroll,
  so the cursor belongs to the query cache. Sharing a link should reopen the same
  filters, not drop the recipient at row 400.
- **The search box owns its own value** (`hooks/useSearchInput.ts`) and writes
  to the URL on a debounce. Binding the input straight to URL state looks
  simpler and is wrong: each keystroke becomes a navigation, and because that is
  not synchronous React re-renders the controlled input with a stale value —
  typing "kha" in a browser produced "a". Debouncing between the box and the URL
  (rather than between the URL and the query) also means the address bar only
  ever holds committed searches, so a copied link matches what is on screen.
- Defaults are omitted when serialising, so the unfiltered view stays a clean
  `/`. Parsing is forgiving — an unknown `sortField` falls back to the default
  rather than throwing. That is the opposite of the server, which rejects the
  same input with a `400`, and the asymmetry is intended: a hand-edited URL is
  a user accident to absorb, a malformed API request is a client bug to surface.

**Zustand deliberately owns very little** — currently just the mobile filter
drawer. It was chosen over Context because the drawer flag toggles often and a
Context value re-renders its whole subtree, which is the wrong behaviour with a
virtualized list of hundreds of rows in that tree. Components read through
selector hooks rather than subscribing to the whole store.

`filters/` and `sorting/` are deliberately presentational: the page hands each
of them the slice it needs plus a change callback. That is what keeps them free
of any dependency on `users` while all three stay in sync.

### 4.3 Data fetching

TanStack Query (`useInfiniteQuery`) provides paginated fetching keyed by the
query state, request de-duplication while the user types, cache reuse on
navigation, and — importantly for the design spec — _separate_ loading flags for
the first page and for subsequent pages. It pairs directly with
`@tanstack/react-virtual` for the list.

Because the facet counts arrive inside the same `UsersResponse` as the rows, the
sidebar reads them from the users query cache instead of issuing its own
request. One request, one consistent snapshot.

**Navigation _is_ fetching.** The query key is derived from the URL state, so
pressing Back rewrites the query string, which re-parses to a different state,
which produces a different key, which React Query serves from cache or
refetches. No effect, no manual invalidation, no `useEffect` syncing two
sources of truth. It is also why Back/Forward feel instant: the previous
state's key is still cached. `useUsersDirectory` is the one hook a screen
needs — it composes the URL state, the search input and the query.

Query keys come from one factory (`features/users/api/query-keys.ts`). Keys are
the cache's identity: built inline in two places they drift, producing duplicate
entries and invalidation that silently misses one. Filter arrays are sorted into
a canonical order inside the key, so selecting Reading-then-Swimming hits the
same cache entry as the reverse — the API returns identical results for both.

The page param is the server's opaque cursor: `initialPageParam` is `null` and
`getNextPageParam` returns `nextCursor ?? undefined`. The client never builds or
parses a cursor. The server issues one only when a row exists beyond the page,
so the client never fetches a trailing empty page just to discover the end.

**Axios, not `fetch`.** All network access goes through
`shared/api/http-client.ts` — the only module in the client that knows HTTP
exists. Axios earns its place on three things this app actually uses: a response
interceptor, so every failure arrives as an `ApiError` without a try/catch in
each caller; a real `timeout`, which `fetch` still lacks without hand-wiring an
AbortController; and `paramsSerializer`, because Axios's default emits
`hobbies[]=a&hobbies[]=b` while the API reads repeated bare keys.

`shared/api/api-error.ts` normalises everything — a 400 with field details, a
network failure, a timeout, a cancelled request, an HTML error page from a
misconfigured proxy — into one `ApiError` carrying `status`, `code`, `message`
and optional `details`. Its `isRetryable` flag drives the query client's retry
policy: 4xx is never retried, because a 400 from the query validator will fail
identically every time and retrying only delays the error the user needs to see.

AbortSignals are threaded from TanStack Query through `getUsers` into Axios, so
changing a filter mid-flight cancels the request that is no longer wanted —
without it, a slow response for an old filter can land after a fast one for the
new filter and overwrite it.

### 4.4 Error handling — two independent layers

Render errors and data errors are different failures and get different
treatment:

- **Render crashes** hit `shared/ui/ErrorBoundary.tsx`, a hand-rolled class
  component (React still has no hook equivalent; a dependency would add an
  upgrade surface for ~40 lines). It is mounted outermost in `AppProviders`,
  wrapped in `QueryErrorResetBoundary` so "Try again" clears both the boundary
  and any failed query — otherwise the retry re-renders children that
  immediately re-throw the cached failure.
- **Data errors** are _not_ escalated to that boundary. `throwOnError` stays at
  its default of `false` so a failed fetch renders as an inline panel with a
  retry, instead of replacing the whole screen and losing the
  user's filters.
- **`networkMode: 'always'`** on the users query. React Query's default
  (`'online'`) consults its connectivity heuristic before fetching or retrying
  and _pauses_ when it thinks the browser is offline: the query stays `pending`
  forever, never reaching `error`. Found by stopping the API against a running
  browser — the UI sat on skeletons indefinitely, `refetch()` was a no-op, and
  `navigator.onLine` was `true` throughout. This API is same-origin and often on
  localhost, where such heuristics mean nothing, so attempting the request and
  reporting a real error is both more honest and more useful. A regression test
  drives `onlineManager.setOnline(false)` and asserts the error still surfaces.
- **`isStalled`** is exposed alongside `isError` as a belt-and-braces guard: a
  query with no data that is not fetching is a failure from the user's side,
  whatever the internal reason, and must never render as an endless skeleton.
- **Routing failures** have their own layer: `errorElement` on the route, plus
  an explicit `*` catch-all, so a mistyped deep link gets a real page with a way
  back rather than a router stack trace.

### 4.5 The virtualized list

`useWindowVirtualizer` rather than a fixed-height scroll container: the page
scrolls naturally, which is what makes mobile behave (address-bar hiding,
momentum) and lets the sticky header and sidebar work.
A nested scroll area would trap the wheel and produce two scrollbars. The cost
is `scrollMargin` — the virtualizer must know where the list starts in the
document, or every card renders one header-height too high. It is held in
**state**, not read from a ref inline, because the ref is null on first render
and an inline read would never be corrected.

Constants live in `features/users/model/list-config.ts` because they are
coupled: the page size has to overfill a viewport, or the list requests page 2
immediately on mount and infinite scroll degrades into a burst of round trips.

Three things keep it cheap, verified against the seeded data (see below):

- `UserCard` and `UserAvatar` are `React.memo`. The virtualizer re-renders its
  parent on every scroll frame, so without this every visible card would
  re-render continuously while scrolling.
- The flattened `users` array is `useMemo`'d in the data hook. A fresh array
  identity per render would invalidate every downstream memo and defeat the
  card memoisation entirely.
- `getItemKey` returns the user id, so React reuses card instances across
  frames instead of remounting them and re-fetching avatars.

Changing the query scrolls back to the top (`useLayoutEffect`, so it happens
before paint) — staying at 24,000px after filtering down to three results
leaves the user staring at blank space.

Avatars are external DiceBear URLs, so `UserAvatar` falls back to initials on
error; a broken-image icon in every card would read as a broken app.

### 4.5.1 Measured performance

Scrolled through the seeded 1,200 users in a real browser, loading ~300 of them:

| Users loaded | Cards in DOM | Total DOM nodes |
| ------------ | ------------ | --------------- |
| 50           | 15           | 561             |
| 100          | 22           | ~600            |
| 302          | 22           | 675             |

The DOM stays flat at ~22 cards regardless of how much data is loaded, which is
the whole point. Scrolling stayed smooth and the sticky header held position
(`headerTop: 0` at a scroll offset of 28,187px).

### 4.6 The sidebar

Built as four layers so the desktop column and the mobile drawer cannot drift
apart: `FilterCheckbox` (one row) → `FilterGroup` (one titled facet list) →
`FilterPanel` (both groups + "Clear all") → `FilterSidebar` / `FilterDrawer`
(presentation). Only the outer two differ between breakpoints.

**Native `<input type="checkbox">`, not a styled `<div role="checkbox">`.** The
native element supplies keyboard operation, the correct role and checked state,
and focus handling — all of which would otherwise be re-implemented, usually
incompletely. It is hidden with `sr-only` rather than `display: none`, which
would drop it from the tab order; the visible box is a sibling driven by
`peer-*`. `<fieldset>`/`<legend>` groups each list so a screen reader announces
"Hobbies" with every control in it.

Both visible spans in a row are `aria-hidden` and the accessible name comes from
a single visually-hidden phrase — otherwise the label concatenates everything
and announces "Reading Reading, 320 users". The phrase is "Reading, 320 users"
rather than "Reading 320", which is ambiguous read aloud.

**The AND/OR asymmetry is stated, not implied.** Ticking a second hobby narrows
the results, which is the opposite of most filter UIs, so each group carries a
one-line caption ("Matches all selected" / "Matches any selected") instead of
leaving the user to infer it from counts going down.

**A selected value always keeps a visible row.** The server returns only the top
20 facets, and a selection can still fall out of that window — select hobby
`Falconry` and a nationality nobody with that hobby holds, and the nationality's
count drops to zero and off the end of the list. It is still filtering, but its
checkbox has vanished and cannot be unticked. `withSelectedAlwaysVisible` re-adds
any such value with `count: 0` (which is the true count) and floats selections to
the top so they cannot scroll out of a 20-item list.

This remains necessary even with the disjunctive nationality counts of §3.4 —
those stop the list collapsing to the selection, but not a low-count selection
falling past position 20.

Only the _first_ load shows skeletons. Re-filtering keeps the previous facets on
screen, so the sidebar does not flash empty on every click.

The mobile drawer implements the full set of modal obligations — focus moves in
on open and returns to the trigger on close, Tab is trapped in both directions,
Escape closes, background scroll is locked, and it is announced as a named
`dialog`. These are invisible in a screenshot and are covered by unit tests.

### 4.7 Search and sort controls

Both live in the sticky header and are rendered
**once**, with the header wrapping to three rows on mobile. Duplicating them per
breakpoint would duplicate their `aria-live` regions, and every sort change
would be announced twice.

**Search** is presentational (`features/users/components/SearchField`); the
debounce and URL write stay in `hooks/useSearchInput`, so the timing logic is
not re-implemented per usage. `type="search"` gets the right mobile keyboard and
role; the native clear affordance is suppressed for an explicit button, because
the native one is unreachable by keyboard in several browsers. The placeholder
is not the label — it disappears on input — so the field carries a real
`<label>`.

**Sort** uses a native `<select>` for the field: type-ahead, arrow keys,
Home/End, correct screen-reader semantics and the platform picker on mobile, all
free. Direction is a **toggle button rather than a second select**, since two
values do not justify open-then-choose. Options come from `SORT_FIELDS` in
`@presight/shared`, so the control cannot offer a sort the API rejects.

Two accessibility details worth keeping: the direction button's accessible name
states what pressing it will _do_ ("Change sort direction to oldest first")
rather than the current state, and the labels adapt to the field — "A–Z" for
names, "Youngest first" for age. "Ascending" is correct everywhere and helpful
nowhere. The select id comes from `useId`, since a hard-coded one would collide
if the control is ever rendered twice.

Sorting changes only the order, so it does not touch the facet counts; search
does, and refreshes the list and both facet lists together — all three come from
the one request keyed on the URL state.

### 4.8 Styling

Tailwind v4, configured **in CSS** (`src/styles/index.css`) — there is no
`tailwind.config.js` to keep in sync. The palette and the 280px
sidebar width are declared once in the `@theme` block as semantic tokens
(`canvas`, `surface`, `primary`, `subtle`, `ink`, `muted`), so components
reference meaning rather than hex values and re-theming touches one file.

### 4.9 Same-origin API

The client always calls relative `/api/...` paths. In development Vite proxies
`/api` to `http://localhost:4000`; in Docker nginx proxies it to the `server`
container. The browser therefore never issues a cross-origin request, and the
same build artefact works in both environments.

---

## 5. Running it

### Local

```bash
yarn install
yarn build                 # shared → server → client (topological)
yarn db:seed               # creates server/data/app.sqlite, migrates, seeds 1200 users
yarn dev                   # server (tsx watch) + client (vite) in parallel
yarn test                  # client unit tests (Vitest)
```

The database commands, in full:

```bash
yarn db:migrate            # apply pending migrations (the seeder and the
                           # server both do this too — it is rarely needed alone)
yarn db:migrate --fresh    # delete the database file, then migrate
yarn db:seed               # skips if users already exist
yarn db:seed --force       # wipe and re-seed (deterministic: same rows, same ids)
yarn db:seed --users=5000 --seed=99   # different size / different dataset
yarn db:reset              # --fresh migrate + seed, from nothing
```

Client: <http://localhost:5173> · API: <http://localhost:4000/api/health>
Override the API port with `PORT` (see `server/.env.example`) and the client's
proxy target with `VITE_API_PROXY_TARGET` (see `client/.env.example`).

### Docker

```bash
docker compose up --build
```

Client on <http://localhost:8080>, API on <http://localhost:4000>; both are
overridable with `CLIENT_PORT` / `SERVER_PORT` when a host port is already
taken. Both images build from the repository root because `@presight/shared` is
a build-time dependency of each. The database lives on the `sqlite-data` named
volume, and the server container runs migrations and the seed before starting.
Full instructions are in [`README.md`](README.md); the decisions behind the
images are below.

**The server base image is load-bearing.** `better-sqlite3@13` ships prebuilt
bindings _inside its npm tarball_ (`prebuilds/linux-<arch>.node`), and
`lib/binding.js` prefers them over anything node-gyp produces. Those glibc
prebuilds require `GLIBC_2.38`, so on `bookworm-slim` (glibc 2.36) the install
succeeds and the binding then fails at _runtime_ with
`libm.so.6: version GLIBC_2.38 not found`. `trixie-slim` ships glibc 2.41. The
build and runtime stages must stay on the same base for the same reason.

**node-gyp reads its headers from the image.** `better-sqlite3`'s install script
is a bare `node-gyp rebuild`, which by default downloads the Node headers from
`nodejs.org` — a network dependency that fails outright behind a TLS-intercepting
proxy. The official Node images already ship a complete header set (including
`common.gypi`/`config.gypi`) under `/usr/local/include/node`, so
`npm_config_nodedir=/usr/local` points node-gyp at them: no download, and the
source-compile fallback still works on architectures with no bundled prebuild.
The compile toolchain lives only in the `deps` stage and never reaches runtime.

**The client image never builds the native module.** Yarn 1 installs every
workspace, so `better-sqlite3` is present in the client's install tree even
though the browser bundle cannot use it. `yarn install --ignore-scripts` skips
its build; nothing in the client build depends on an install hook, and it drops
a C++ toolchain from that image entirely.

**The server runtime gets its own production-only install.** For the same
reason — one hoisted `node_modules` for the whole monorepo — copying the build
stage's tree into the runtime image shipped Vite, Vitest, Playwright, Lerna,
TypeScript and the client's React to production: 356 MB of `node_modules` to run
a four-dependency server. A separate `prod-deps` stage runs
`yarn install --production` from the same manifests, which the runtime stage
copies instead. 57 MB, and a 556 MB image down to 302 MB.

**nginx caching.** Hashed assets are immutable and get a one-year
`Cache-Control`; `index.html` is explicitly `no-cache`, because it names those
hashed bundles and a heuristically-cached copy can outlive the files it points
at.

---

## 6. Testing

Three layers, each covering what the one below cannot.

**Server** — Vitest (`yarn workspace presight-server test`), 87 specs across
seven files, run against a **real** in-memory SQLite database built by the same
migrations and the same deterministic seeder production uses. What is tested is
therefore the real schema, not a fixture that can drift from it.

The load-bearing choice is the **oracle** (`src/test/fixture.ts`): the three raw
tables are loaded into memory and every expected result is recomputed in plain
JavaScript with `Array.filter`/`Set`, sharing no code and no reasoning with the
repository layer. Comparing one SQL query against another only re-confirms the
same assumptions; comparing SQL against a from-scratch reimplementation is what
catches a semantic error. Coverage:

| Area                | What is asserted                                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Filter semantics    | every single hobby, all pairs of the ten most common, sampled triples, every nationality, and the three filters composed                   |
| Sorting, pagination | exhaustive cursor walks compared **element for element** against the oracle, every sort in both directions; inserts and deletes mid-scroll |
| Facet counts        | value, count and ordering across eight filter states                                                                                       |
| Pagination envelope | `limit + 1` probe boundaries and the cursor's position, with fake repositories                                                             |
| Validation          | the accept/reject policy at the trust boundary                                                                                             |
| HTTP                | the real Express app end to end, on an ephemeral port                                                                                      |

**Client** — Vitest + Testing Library (`yarn test`), 141 specs covering the URL
codec, history semantics, the search-input binding, the filter panel, the
drawer's modal behaviour, the search and sort controls, the user card's hobby
rules and the data hook's state machine. Integration specs drive the real hooks
and assert on the resulting query string, which is where a page-level wiring
mistake would otherwise hide.

Hook tests run in jsdom against the _real_ History API rather than a mock: back
and forward cannot be verified against something with no history stack.

**Browser** — Playwright against the system Chrome, so no browser download
(`yarn e2e`):

| Suite            | Covers                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| `responsive.mjs` | desktop/tablet/mobile layouts, the drawer's modal behaviour, no horizontal overflow at 320–1440px |
| `states.mjs`     | skeleton, empty and error states, keyboard operation, focus visibility, `prefers-reduced-motion`  |
| `filters.mjs`    | nationality multi-select (OR widens) and hobby narrowing (AND)                                    |
| `url-state.mjs`  | deep-link restore of all five values, reload, and back/forward                                    |

All four take a `BASE_URL`, so they run against either the dev server or the
container:

```bash
BASE_URL=http://localhost:8080 yarn e2e
```

That also covers the virtualized list, which jsdom cannot: it reports every
element height as zero, so the virtualizer renders nothing there and any
assertion would pass whether or not virtualization worked.

---

## 7. Known limitations

- **`shared/ui` is thin.** The repeated button and badge styles are still inline
  Tailwind. Worth extracting now that the usage patterns have settled; doing it
  earlier would have meant guessing at the abstraction.
- **Cursor pagination has no random access.** There is no "jump to page N";
  a paged table UI would need `OFFSET` back, or a different design (for
  example, a search instead of page 40).
- **`NOCASE` folds ASCII only**, so `Müller` would not match a search for
  `muller`. Nothing in the seed is non-ASCII. The fix, if ever needed, is a
  normalised `search_text` column plus an index — noted in `001_init.sql`.
- **1–2 character searches still scan.** They are too short for the trigram
  index and fall back to `LIKE`. They also match the most rows, so the facet
  queries dominate their cost anyway.
- **Case folding differs slightly between the two search paths.** `NOCASE`
  (LIKE path) folds ASCII only; the trigram tokenizer folds Unicode case too.
  Every seeded name is ASCII, so results are identical today.
