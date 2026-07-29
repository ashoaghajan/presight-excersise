# Presight User Directory

A full-stack user directory: React + Vite client, Node + Express API, SQLite as
the source of truth. Server-side search, filtering (nationality OR, hobby AND),
sorting, pagination, result-set-aware facet counts, URL-synced state and a
virtualized infinite list.

- **[ARCHITECTURE.md](ARCHITECTURE.md)** — how it is built and why.
- **[docs/API.md](docs/API.md)** — the `GET /api/users` contract.

---

## Quick start (Docker)

Requires Docker with Compose v2. Nothing else — no local Node, no manual
seeding.

```bash
docker compose up --build
```

- Client: <http://localhost:8080>
- API: <http://localhost:4000/api/users?limit=5>

The server container migrates the schema and seeds 1200 users before it starts
serving, so the app has data on first load.

Stop with `Ctrl-C`, or:

```bash
docker compose down     # stop and remove containers, keep the database
docker compose down -v  # also delete the volume, so the next run re-seeds
```

### If port 4000 or 8080 is taken

Only the published host ports move; nothing inside the network changes:

```bash
CLIENT_PORT=9090 SERVER_PORT=4100 docker compose up --build
```

A port collision is easy to misread, because the container starts healthy and
only the host side is shadowed. If <http://localhost:4000/api/users> returns
something that isn't this API, another process already owns the port.

### How it fits together

| Service  | Image                    | Role                                                     |
| -------- | ------------------------ | -------------------------------------------------------- |
| `server` | Node 22 (trixie-slim)    | Express API; migrates + seeds, then serves on `:4000`    |
| `client` | nginx 1.27 (alpine)      | serves the built bundle, proxies `/api` to `server`      |

The browser only ever talks to the client origin — nginx proxies `/api` to the
server container, mirroring the Vite dev proxy, so no request is cross-origin
in either environment.

Both images build from the **repository root**, because `@presight/shared` is a
build-time dependency of each.

### SQLite persistence

The database lives on the `sqlite-data` **named volume**, mounted at `/data`
(`DATABASE_PATH=/data/app.sqlite`) — not a bind mount, which would write a
root-owned database file into the working tree.

It therefore survives `docker compose down` and container rebuilds: the seeder
skips a database that already has users, so a restart re-uses the existing data
instead of regenerating it. To start clean, remove the volume with
`docker compose down -v`.

To re-seed without destroying the volume:

```bash
docker compose exec server node dist/db/seed/cli.js --force
docker compose restart server
```

---

## Local setup (without Docker)

Requires **Node 22** and **Yarn 1** (this is a Yarn 1 workspaces monorepo:
`shared`, `server`, `client`).

```bash
yarn install
yarn build      # builds shared → server → client, in topological order
yarn db:seed    # creates server/data/app.sqlite, migrates, seeds 1200 users
yarn dev        # server (tsx watch) + client (vite), in parallel
```

- Client: <http://localhost:5173>
- API: <http://localhost:4000/api/health>

`yarn build` before the first `yarn dev` is not optional: both the server and
the client type-check against `shared/dist`.

Other useful scripts:

```bash
yarn test        # 228 unit/integration tests (87 server, 141 client)
yarn typecheck   # every workspace, including test sources
yarn e2e         # Playwright browser checks (needs the app running)
yarn format      # Prettier
```

### Testing

| Suite      | Run with                                | What it covers                                                                                       |
| ---------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Server** | `yarn workspace presight-server test`   | filter semantics, sorting, pagination and facet counts against a real in-memory SQLite DB             |
| **Client** | `yarn workspace presight-client test`   | URL codec and history semantics, search debounce, filter panel, drawer modal behaviour, card rules    |
| **E2E**    | `yarn e2e`                              | responsive layouts 320–1440px, skeleton/empty/error states, keyboard and focus, `prefers-reduced-motion`, the filter semantics (multi-select OR vs narrowing AND), and URL deep-link / reload / back-forward restore |

The server suite checks results against an **independent oracle** — the raw
tables reloaded and recomputed in plain JavaScript — rather than against another
SQL query, which would only re-confirm the same assumptions.

The e2e suite takes a `BASE_URL`, so it can be pointed at either environment:

```bash
BASE_URL=http://localhost:8080 yarn e2e   # against the Docker stack
```

### Configuration

Every value has a working default, so no `.env` file is needed to start.
Copy the examples to override: `server/.env` (from `server/.env.example`) and
`client/.env.local` (from `client/.env.example`).

| Variable                | Side   | Default                 | Purpose                                |
| ----------------------- | ------ | ----------------------- | -------------------------------------- |
| `PORT`                  | server | `4000`                  | API port                               |
| `DATABASE_PATH`         | server | `./data/app.sqlite`     | relative paths resolve against `server/` |
| `CORS_ORIGIN`           | server | `http://localhost:5173` | comma-separated allowed origins        |
| `LOG_LEVEL`             | server | `info`                  | `debug`…`silent`                       |
| `VITE_API_BASE_URL`     | client | `/api`                  | API base path                          |
| `VITE_API_PROXY_TARGET` | client | `http://localhost:4000` | where the dev proxy forwards `/api`    |

---

## Database and seeding

SQLite is the source of truth. The schema is three tables — `users`, `hobbies`
and `user_hobbies` — a real many-to-many relation, because "has *all* selected
hobbies" and per-hobby counts are only expressible relationally.

Migrations are plain `.sql` files applied in filename order and recorded in
`schema_migrations`. The server applies pending migrations on boot, so it can
never serve against a stale schema. Seeding is deliberately **not** part of
boot — inserting demo rows is an explicit operator action.

```bash
yarn db:seed                        # migrate, then seed 1200 users (skips if already populated)
yarn db:seed --force                # wipe and re-seed
yarn db:seed --users=5000 --seed=99 # different size / different dataset
yarn db:migrate                     # apply pending migrations only
yarn db:migrate --fresh             # delete the database file, then migrate
yarn db:reset                       # --fresh migrate + seed, from nothing
```

The seed is **deterministic**: it uses a seeded PRNG and truncates the
AUTOINCREMENT counters, so the same `--seed` reproduces identical rows with
identical ids. Data is weighted rather than uniform (so the top-20 facet
ordering is meaningful) and name pools are small enough that duplicate full
names occur — which is what actually exercises the mandatory `id` tie-breaker.

---

## Original exercise brief

Build a small full-stack user directory application. The goal is to evaluate how you design a searchable, filterable, paginated UI backed by persisted data and clear API boundaries.

The application should include:

- A React client.
- A Node.js API server.
- A SQLite database used as the source of truth for user data.
- Docker configuration for running the application locally.

## Scenario

Users need to browse a large directory of people, search by name, and narrow results by nationality and hobbies. The filter sidebar should help users discover useful filters based on the result set they are currently viewing.

## Requirements

### Data Model

Seed a SQLite database with enough records to make pagination, infinite scroll, search, and filter counts meaningful.

Each user should have:

- `avatar`
- `first_name`
- `last_name`
- `age`
- `nationality`
- `hobbies`, from 0 to 10 hobbies per user

Choose a data model that supports the required behavior.

SQLite must be the persisted source of user data.

### API

Expose an API that supports:

- Paginated user results.
- Text filtering from user input across `first_name` and `last_name`.
- Filtering by one or more nationalities.
- Filtering by one or more hobbies.
- Sorting by `first_name`, `last_name`, `age`, and `nationality`.
- Pagination metadata so the client can determine whether more results are available.
- Top 20 hobbies for the active text filter and filter state, including `{ value, count }`.
- Top 20 nationalities for the active text filter and filter state, including `{ value, count }`.

The top 20 values and counts must reflect the currently applied text filter and selected filters, not the global dataset.

Filter semantics:

- Multiple selected hobbies should match users who have all selected hobbies.
- Multiple selected nationalities should match users from any selected nationality.
- Text, hobby, and nationality filters should apply together.

Sorting semantics:

- Sorted results must be deterministic. Use `id` as a final tie-breaker when values are equal.
- Pagination must respect the active sort without duplicate or missing users.

### Client

Build a React interface that includes:

- A text filter input for `first_name` and `last_name`.
- A virtualized, infinitely scrolling list of user cards.
- A sidebar containing the top 20 hobbies and top 20 nationalities for the current result set, including counts.
- Controls for applying and removing hobby and nationality filters.
- Controls for choosing sort field and sort direction.
- Loading, empty, and error states.
- A responsive layout that remains usable on desktop and mobile.

User cards should follow this structure:

```text
|----------------------------------|
| avatar      first_name+last_name |
|             nationality      age |
|                                  |
|             (2 hobbies) (+n)     |
|----------------------------------|
```

Show up to 2 hobbies on the card. If the user has more hobbies, display the remaining count as `+n`.

Use a virtual scroll implementation for the list.

When the text filter or selected filters change, the client must refresh both:

- The paginated user list.
- The top 20 hobbies and nationalities in the sidebar.

The text filter value, selected hobbies, selected nationalities, sort field, and sort direction must be reflected in the URL query string. Reloading or sharing the URL should restore the same view state.

## Implementation Notes

- Keep the database setup easy to run locally.
- Include seed logic or a documented command that creates the SQLite database.
- Include a `Dockerfile` and `docker-compose.yml` that can run the application locally.

## Evaluation Focus

We will pay particular attention to:

- Correct data persistence and API behavior.
- Correct filtering, sorting, pagination, and top 20 counts.
- Smooth infinite scrolling with virtualization.
- URL-synced state.
- Clear loading, empty, and error states.
- Easy local and Docker-based setup.

## Deliverables

Please provide:

- Source code for the React client and Node.js server.
- A `Dockerfile` and `docker-compose.yml`.
- Instructions for setup, database seeding, and running locally.
- Instructions for running with Docker Compose.
