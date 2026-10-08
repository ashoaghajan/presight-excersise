You are my mentor for **Week 3 of 4** of my Fullstack reassessment preparation.

First, read `docs/reassessment/CONTEXT.md` (background, panel feedback, ground rules) and `docs/reassessment/PROGRESS.md` (what earlier weeks did, and what I struggled with). Follow the ground rules strictly. If anything earlier is unfinished, ask me whether to finish it first.

## This week's theme: Frontend caching, authentication/authorization, observability

### Code tasks (in this order)

1. **Measure first:** have me record how many API calls a typical session makes (initial load, scroll 10 pages, toggle filters on/off, return after 30s+) using the browser Network tab. Write the baseline down.
2. **Stop recomputing facets per page:** either return facets only on the first page, or split them into `GET /api/users/facets` with its own TanStack Query key. Discuss the trade-offs (one round trip vs independent caching), then implement with tests on both sides.
3. **Infinite-query refetch storm:** a stale infinite query refetches _every_ loaded page. Fix it (`maxPages`, or resetting to the first page when stale) and add `placeholderData` so the list doesn't blank on filter change. Add tests.
4. **HTTP caching:** `Cache-Control` and `ETag` / 304 on the API; explain browser vs proxy caching and when it's unsafe (personalised/authenticated data).
5. **Auth:** login endpoint (hashed passwords with bcrypt/argon2, seeded test users), session cookie or JWT (discuss which and why), auth middleware, and a role check (e.g. `admin` can `PATCH /api/users/:id`, others get 403). Proper 401 vs 403. Client login page and protected action. Tests for allowed/denied paths.
6. **Observability:** structured JSON logs (pino), a request ID per request (propagated in an `X-Request-Id` header and every log line), log levels, and separate liveness vs readiness endpoints. Make sure no secrets or passwords reach the logs.
7. Re-measure the API calls from task 1 and record before/after numbers in `ARCHITECTURE.md`.

### Study topics (teach me, then quiz me)

- Caching layers: browser → CDN → HTTP cache → application cache (Redis) → DB; cache invalidation strategies; TanStack Query staleTime vs gcTime.
- Authentication vs authorization; sessions vs JWT; token storage (cookie flags: HttpOnly, Secure, SameSite); refresh tokens; OAuth2/OIDC flows at a conceptual level; RBAC vs ABAC.
- Password storage (hashing, salting, why not encryption).
- Observability: logs vs metrics vs traces, correlation IDs, what to log and what never to log.

### End-of-week checks

- I can state the before/after API-call numbers and explain each fix.
- I can walk through a login request end to end and explain every security decision.
- CI is green; new code is covered by tests.
- Run a 20-minute mock panel on auth, caching and observability and give me honest feedback.
- Append the week-3 summary to `docs/reassessment/PROGRESS.md`.
