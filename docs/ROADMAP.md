# Build Roadmap (autonomous backlog)

This is the decomposition of the requirements into an ordered backlog of small,
independently verifiable slices. Each row becomes one OpenSpec change, built by
the `/autopilot` loop: `propose → apply (maker) → verify (gates + Playwright
e2e + artifact) → review (sub-agent) → archive → next`.

- **Status values:** `pending` → `in-progress` → `blocked` → `done`.
- **Ordering:** top-to-bottom respects dependencies; build foundations first.
- This file is the loop's source of progress. The loop updates a row's status
  and links the archived change; it may split a slice if it proves too big.
- Regenerate/refresh with `/decompose`. Trace every slice to upstream IDs.

## How the loop reads this

1. Pick the first slice whose status is `pending` and whose dependencies are all
   `done`.
2. Run the full change cycle for it (see `/autopilot`).
3. On success mark `done` + link the change; on a hard blocker mark `blocked`
   with a reason and continue with the next independent `pending` slice.

## Phase 0 — Foundations

| ID | Slice | Depends on | Upstream IDs | Status |
| --- | --- | --- | --- | --- |
| R-01 | Monorepo scaffold: npm workspaces, TypeScript strict, ESLint + Prettier, Vitest, shared config | — | BR-PROJ-02..03, T-01, T-12, T-13, Q-01 | done |
| R-02 | Supabase local dev: `supabase init`, `config.toml`, migration skeleton, local stack, migration lint | R-01 | T-03, T-14 | done |
| R-03 | CI/CD + repo security gates: GitHub Actions (typecheck/lint/format/test), CodeQL, Dependabot, Dependency Review, actionlint, secret scanning, `.env.example` | R-01 | BR-PROJ-02..03, T-13, Q-05, NFR-OPS-04 | pending |

## Phase 1 — Data and access

| ID | Slice | Depends on | Upstream IDs | Status |
| --- | --- | --- | --- | --- |
| R-04 | Core schema + RLS migrations (profiles, sources, flows, flow_sources, articles, flow_articles, digests, delivery_channels, delivery_attempts, operational_events, integration_circuits), deny-by-default RLS | R-02 | D-01..06, A-02, NFR-SEC-02 | pending |
| R-05 | Supabase Auth: Google/GitHub OAuth (PKCE), session handling, RLS bound to `auth.uid()`, dev-only password auth disabled in prod | R-04 | BR-USER-01, T-06, NFR-SEC-01 | pending |
| R-06 | `api` Edge Function skeleton: JWT verification, `{data,error}` envelope, Zod boundary validation, CORS allowlist | R-05 | A-01, A-06, NFR-SEC-02 | pending |

## Phase 2 — Domain CRUD (API + UI)

| ID | Slice | Depends on | Upstream IDs | Status |
| --- | --- | --- | --- | --- |
| R-07 | Profile management (interests, languages, channels) — API + React UI | R-06 | BR-USER-02, NFR-UX-01 | pending |
| R-08 | Source management (RSS/Atom + single article URL) — API + UI + SSRF validation | R-06 | BR-SRC-01..03, NFR-SEC-05 | pending |
| R-09 | Flow management (CRUD, enable/disable, 5-flow quota, prompt choice/custom) — API + UI | R-06 | BR-FLOW-01, BR-FLOW-07, BR-USER-03, NFR-CON-01 | pending |
| R-10 | Delivery channels (in-app, email, Telegram link, Slack webhook, generic signed webhook) — API + UI + AES-GCM encryption + HMAC signing | R-06 | BR-DEL-01..06, T-09, NFR-SEC-03..06 | pending |

## Phase 3 — Processing pipeline

| ID | Slice | Depends on | Upstream IDs | Status |
| --- | --- | --- | --- | --- |
| R-11 | Queue + scheduler infra: `pgmq` queues, `pg_cron` schedules, `schedule-daily`/`work`/`cleanup` functions, claim + lease + dead-letter | R-04 | BR-FLOW-02, A-03/04, T-05, NFR-REL-01..05, NFR-CON-02 | pending |
| R-12 | Ingestion worker: shared fetch, SSRF revalidate on redirect, feed parse + readability extraction, dedupe, source-health pause after 5 fails | R-11, R-08 | BR-SRC-04..06, T-07, NFR-PERF-01, NFR-PERF-04, NFR-SEC-05 | pending |
| R-13 | AI processing worker: batch, near-dup grouping (n-gram Jaccard), truncation budget, OpenAI Responses API strict structured output, usage recording, `no_content` | R-11, R-09, R-12 | BR-FLOW-02..06, T-08, T-11, NFR-PERF-03, NFR-CON-02..03 | pending |
| R-14 | Delivery workers: in-app, Brevo email, Telegram bot, Slack webhook, generic signed webhook; bounded retries + backoff + circuit breaker | R-11, R-10, R-13 | BR-DEL-02..05, T-10, NFR-REL-02..04, NFR-PERF-04, NFR-SEC-04..05 | pending |
| R-15 | Feedback: thumbs up/down capture + reporting (no auto prompt change) | R-13 | BR-FLOW-08 | pending |

## Phase 4 — Lifecycle, ops, delivery

| ID | Slice | Depends on | Upstream IDs | Status |
| --- | --- | --- | --- | --- |
| R-16 | Retention/cleanup: 7-day purge (≤1h lag), 24h cache expiry, lease recovery, dead-letter surfacing | R-11 | BR-DATA-01..02, NFR-DATA-01..03, AT-08 | pending |
| R-17 | Observability: structured logs + correlation ids, `OperationalEvent`, deduped Brevo operator alerts, AI usage/quota monitoring, fail-closed on free-tier exhaustion | R-11 | A-07, NFR-OPS-01..03, AT-10/12 | pending |
| R-18 | Dashboard polish + responsive Playwright e2e for critical flows (digest history, run status, source warnings) | R-07..R-10, R-14 | NFR-UX-01, NFR-PERF-02, Q-04 | pending |
| R-19 | Deploy config: `vercel.json` (SPA rewrites + security headers), Supabase deploy config, idempotent `infra/scripts/` bootstrap/audit — **human bootstrap gated** | R-03, R-18 | BR-PROJ-01..03, T-04, T-14, NFR-CON-04..08 | pending |

## Human bootstrap required (cannot be automated)

The loop builds and verifies everything locally, but these need a human because
they require accounts, credentials, or spend. The loop records them here and
does **not** fake them:

- Create Supabase project; provide project ref + keys (`R-05`, `R-19`).
- Register Google + GitHub OAuth apps; provide client id/secret (`R-05`).
- OpenAI API key (usage-billed, outside $0) (`R-13`).
- Brevo account + verified sender (`R-14`).
- Telegram bot token (`R-14`).
- Vercel project link for the frontend (`R-19`).
- Set all secrets in GitHub environments / provider secret stores — never in git.
- Final merge to `main` and production deploy (human-gated by default).
