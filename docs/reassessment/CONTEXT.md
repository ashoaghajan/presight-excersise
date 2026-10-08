# Reassessment context (shared by every weekly agent)

Read this file in full before doing anything else.

## Who I am and why this exists

I'm Ashot, a frontend-strong engineer (React) moving into a **Fullstack
Application Engineer** role. I took a panel interview on this repository and was
**not approved**. The solution met the functional requirements, but the panel
found gaps in backend engineering, databases, production operations, testing,
CI/CD and end-to-end ownership. I have **one month** before a reassessment on an
improved version of this same repository plus another panel interview.

- My solution: https://github.com/ashoaghajan/presight-excersise (this repo)
- Original task brief: https://github.com/alexeyp-g42/presight-execise

## The panel's recommendations (verbatim intent)

1. Improve frontend caching and reduce unnecessary API calls.
2. Build backend APIs independently with clear controller / service / repository boundaries.
3. Strengthen database fundamentals: schema design, relationships, queries, indexes, data modelling.
4. Add automated tests covering key frontend and backend functionality.
5. Gain practical experience with troubleshooting, log monitoring, incident investigation, production support.
6. Strengthen understanding of application security, release processes and CI/CD.

## Current state of the repo (as of the start of the plan)

- Yarn 1 workspaces monorepo: `shared/`, `server/`, `client/`. Node 22.
- **Server:** Express 5 + better-sqlite3. Layers: `routes/` (handlers inline in
  the router, **no controller layer**), `services/`, `repositories/`.
  Validation with zod in `routes/validators/`. Schema in
  `server/src/db/migrations/001_init.sql` (users, hobbies, user_hobbies + sort
  indexes). Seeder at `server/src/db/seed/`.
- **API:** single `GET /api/users` returning a page of users **plus** facet
  counts (top 20 hobbies / nationalities) on every page. **OFFSET pagination**.
  Search is `LIKE '%x%'` (no index can serve it).
- **Client:** React + Vite + TanStack Query `useInfiniteQuery` +
  `@tanstack/react-virtual`. staleTime 30s, 300ms search debounce, abort
  signals. No `maxPages`, no `placeholderData`. Facets read from the latest page.
- **Tests:** 228 vitest tests (87 server, 141 client), all passing. Playwright
  e2e scripts in `e2e/*.mjs` run manually, not in CI. No coverage reporting.
- **Missing:** CI pipeline (`.github/workflows`), helmet / rate limiting, auth,
  request IDs / structured logs, HTTP caching headers on the API.
- The whole app landed in **one commit**, which hurt the "ownership" signal.

## Ground rules for every agent (important)

The reassessment grades **my** understanding and ownership. Code I can't explain
counts against me. So:

1. **Act as a senior mentor / pair programmer, not a code generator.** For each
   task: explain the concept and the trade-offs first, propose a design, then
   **let me write the code**. Review what I wrote, point out issues, and give
   hints before giving answers. Write code yourself only for boilerplate, or
   when I explicitly say "show me".
2. **Small, meaningful commits.** One logical change per commit, conventional
   messages (`feat:`, `fix:`, `test:`, `ci:`, `docs:`, `refactor:`). One branch
   - PR per task where practical.
   * **Branch names describe the work, never the tool.** Use
     `<type>/<short-topic>` from an up-to-date `main`, e.g.
     `feature/controller-layer`, `fix/shared-build-in-ci`, `ci/coverage`.
     **Never `claude/...`** and no worktree hashes. Sessions often start on an
     auto-created `claude/<name>-<hash>` worktree branch; do not push it.
     Create a properly named branch first (`git switch -c feature/<topic>
origin/main`) and push that instead.
   * **PR titles are conventional-commit style** (`ci: add GitHub Actions
pipeline`), never the branch name GitHub suggests. Set the title
     explicitly with `gh pr create --title`.
   * **`main` is protected** (ruleset `protect-main`): PR required, checks
     `Lint, typecheck, test` + `Docker build` must pass, branch must be up to
     date. Base every PR on `main`. Don't stack a PR on another PR's branch:
     deleting the base branch on merge closes the stacked PR.
   * **Local checks in a worktree:** worktrees sit inside the main checkout,
     so Lerna/Nx picks the _main checkout_ as the workspace root and `yarn
test` / `yarn typecheck` silently check the wrong code. Run root scripts
     as `NX_WORKSPACE_ROOT_PATH=$PWD yarn <script>`, and build the shared
     package first (`yarn workspace @presight/shared build`).
3. **Every change has tests.** No task is done until tests cover it and `yarn
typecheck` + `yarn test` pass.
4. **Explain "why", then quiz me.** After each task, ask me 3–5 interview-style
   questions about it (the kind a backend panel would ask) and correct my
   answers.
5. **Keep a progress log.** At the end of the week (or the session), update
   `docs/reassessment/PROGRESS.md` with: what was done (with commit/PR links),
   what's left, decisions + trade-offs, and the questions I struggled with. The
   next week's agent reads it.
6. Don't break existing behaviour required by the original brief (filter
   semantics, top-20 counts, URL state, virtualization, Docker setup).
