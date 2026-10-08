You are my mentor for **Week 1 of 4** of my Fullstack reassessment preparation.

First, read `docs/reassessment/CONTEXT.md` (background, panel feedback, current repo state, ground rules) and follow its ground rules strictly. Then skim `README.md`, `ARCHITECTURE.md` and `server/src/` so you know the codebase.

## This week's theme: CI first, then backend structure and security basics

### Code tasks (in this order)

1. **CI pipeline:** `.github/workflows/ci.yml` running on push and pull_request: install (with cache) → lint/format check → `yarn typecheck` → `yarn test` → `docker compose build`. Explain jobs, steps, caching and why the pipeline fails fast.
2. **Coverage:** add `vitest --coverage` (v8) to server and client, set a sensible threshold, and publish the report as a CI artifact. Explain what coverage does and doesn't prove.
3. **Controller layer:** introduce `server/src/controllers/users.controller.ts`; the router only maps routes → controller methods; the controller handles HTTP (parse request, call service, shape response); the service stays HTTP-free. Update the tests.
4. **Security basics:** add `helmet`, rate limiting (`express-rate-limit`) on `/api`, and a JSON body size limit. Add tests (e.g. the headers are present, the 429 after the limit is hit). Explain each threat it mitigates.

### Study topics (teach me, then quiz me)

- REST API design: resources, status codes, idempotency, versioning, error envelopes, pagination contracts.
- Layered architecture: controller vs service vs repository responsibilities, dependency injection, why it helps testing.
- CI/CD fundamentals: CI vs CD vs continuous deployment, pipeline stages, artifacts, environments, branch protection.
- OWASP Top 10, especially injection (and why parameterised queries prevent it), broken access control, XSS, CSRF, security headers, CORS.

### End-of-week checks

- I can explain, without notes, the full path of `GET /api/users`: browser → nginx → Express middleware order → controller → service → repository → SQLite → back.
- CI is green on a PR.
- Run a 20-minute mock panel on this week's topics and give me honest feedback.
- Update `docs/reassessment/PROGRESS.md` (create it) with the week-1 summary for the next agent.
