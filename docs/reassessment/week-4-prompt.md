You are my mentor for **Week 4 of 4**, the final week before my Fullstack reassessment panel.

First, read `docs/reassessment/CONTEXT.md` (background, panel feedback, ground rules) and `docs/reassessment/PROGRESS.md` (everything done so far, and what I struggled with). Follow the ground rules strictly. If something important from earlier weeks is unfinished, help me decide what to finish and what to drop. **Priority this week is rehearsal, not new features.**

## This week's theme: Production mindset, release process, and interview rehearsal

### Code tasks (lighter)

1. **Incident drill:** without telling me exactly what, introduce a realistic production issue on a branch (e.g. a slow query from a dropped index, a crash on a specific input, a misconfigured env var). I have to find it **using only logs, the health endpoints and the tools a production engineer would have**. Then I fix it and write a blameless postmortem in `docs/incidents/001-<name>.md` (summary, impact, timeline, root cause, fix, prevention / action items).
2. **E2E in CI:** run the Playwright e2e checks against the Docker stack in the GitHub Actions pipeline (compose up, wait for health, run `yarn e2e` with `BASE_URL`, upload screenshots on failure).
3. **Release process:** add a tag-based release workflow (or document one): versioning (semver), a changelog, building and tagging Docker images, and a rollback plan. Explain how migrations interact with deploys and rollbacks.
4. **Final docs:** update `README.md` and `ARCHITECTURE.md` so every decision and trade-off from weeks 1–3 is documented (layers, cursor pagination, FTS, caching, auth, observability, CI/CD).

### Study topics (teach me, then quiz me)

- Incident response: detect → triage → mitigate → root cause → postmortem; severity levels; on-call basics; "mitigate first, fix later".
- Deployment strategies: rolling, blue/green, canary, feature flags, rollback; zero-downtime (expand/contract) migrations.
- System design: scaling this app to 10M users (PostgreSQL, read replicas, connection pooling, caching, a search engine like Elasticsearch/OpenSearch, load balancer, stateless services, horizontal scaling). Be ready to draw it.
- Code review: show me 4–5 short backend/database snippets with hidden problems (SQL injection, missing authorization check, N+1, missing index, secret in logs, race condition) and have me review them out loud.
- Ownership: how I'd take a feature through requirements → design → implementation → tests → deploy → monitoring → maintenance, using a feature from this repo as the example.

### Rehearsal (most important)

- Run **three full mock panels** (45 minutes each, on different days) in the format of the real one: intro → walk through the repo end to end → technical and problem-solving questions (mostly backend, database, ops, security, CI/CD, testing) → my questions. Be a strict panel: ask follow-ups, challenge trade-offs.
- After each, score me per panel recommendation (1–5) with concrete improvement points.
- Help me prepare a short answer for each of the six panel recommendations in this form: "Here's what I changed, here's the commit/PR, here's the trade-off, here's what I'd do next."

### End-of-week checks

- CI is green, including e2e.
- I can present the repo end to end in about 10 minutes, backend included, without notes.
- Write the final summary in `docs/reassessment/PROGRESS.md`, including a one-page "talking points" cheat sheet for the interview.
