# Agent State

## Current Position

- **Last completed stage**: R-20 (`r-20-browser-auth-lifecycle`)
- **Active implementation slice**: none; roadmap Phase 4 slices are complete.
- **Current checkpoint**: Added a non-technical deployment setup guide at
  `docs/deployment_setup_guide.md`. It records where to create provider
  accounts, where to obtain each token, which store receives each value, the
  current Vercel/Supabase deploy order, smoke tests, common failures, and the
  current automation gap that GitHub Actions verifies but does not yet perform
  a full production Supabase deploy. Added a Vercel root-directory warning after
  a deployment failed with `tsc: command not found` because Vercel built from
  `packages/browser` instead of the workspace root. Declared all four Edge
  Functions in `supabase/config.toml` so the Supabase GitHub integration can
  deploy them from `main`, and extended the deployment audit to guard that
  config. Replaced the deprecated local email config key `[local_smtp]` with
  `[inbucket]` after Supabase Preview rejected it as invalid. Provider
  deployment/API-key references were rechecked on 2026-07-06; Supabase GitHub
  deployment behavior and config keys were rechecked on 2026-07-07. Added a
  hosted cron repair migration after production cron failed with
  `schema "net" does not exist`; the repair enables `pg_net` and recreates the
  schedules with configurable hosted Supabase URLs. Updated scheduled function
  auth so manual and cron calls use `SCHEDULER_SECRET`, while the service-role
  key remains internal to the functions. Added explicit forced scheduler smoke
  tests and diagnostics because a successful manual call can correctly enqueue
  zero jobs when active flows are not due yet.
- **Previous checkpoint**: R-20 OpenSpec change is archived at
  `openspec/changes/archive/2026-07-05-r-20-browser-auth-lifecycle/`, with
  fresh independent verifier PASS and reviewer APPROVE reports retained. R-20
  implementation has added browser auth-route helpers, OAuth callback/session
  restoration handling, protected dashboard paths, route-synced tabs, logout
  cleanup, production-hidden password controls, focused Vitest coverage, and
  expanded Playwright auth lifecycle coverage. Coverage exposed a pre-existing
  nondeterministic Telegram verification path, so the Telegram verifier now
  passes its DNS resolver hook into the SSRF-protected fetch helper and the
  success test supplies a safe Telegram IP. Maker checks currently passed:
  focused auth-routing Vitest, focused Telegram verification Vitest, `npm run
  typecheck`, `npm run lint`, `npm run format`, `npm run test` (15 files, 161
  tests), `npm run test:coverage`, `npm run build:browser`, `npm run test:e2e`
  (10 Chromium tests), `npm run verify:local`, `npm run supabase:lint`, `npm run
  test:integration` (3 files, 5 tests), `openspec validate --all --strict` (20
  items), and `git diff --check`. The first independent reviewer pass requested
  changes for overly broad callback error parsing and logout failure local-state
  cleanup; the maker fixed both and added Playwright regressions. Fresh
  independent verifier PASS and reviewer APPROVE reports were retained before
  archive. R-20 was committed as `45af8dd`, pushed to `origin/main`, and passed
  GitHub `CI` run `28745843691` plus `CodeQL` run `28745843672`.
- **Earlier checkpoint**: R-19 deploy config bootstrap is archived at
  `openspec/changes/archive/2026-07-05-r-19-deploy-config-bootstrap/` with
  fresh independent verifier PASS and reviewer APPROVE reports. R-19 was
  committed as `ceaa367`; follow-up repair commit `fa0bf6f` fixed a
  pre-existing nondeterministic crypto tamper test. GitHub `CI` run
  `28740880409` and `CodeQL` run `28740880398` passed for `fa0bf6f`. Final
  documentation closure commit `b5d4000` also passed GitHub `CI` run
  `28741013482` and `CodeQL` run `28741013480`. No provider accounts, project
  links, secrets, paid features, or production deploys have been created.
- **Paused draft**: none. The previous R-12 draft has been replaced by the active R-12 implementation.
- **Loop mode**: autopilot on `main`; user explicitly requested a commit and
  push checkpoint on 2026-07-03 and explicitly requested push/CI watching on
  2026-07-05. No deploy/spend/account creation.

## Evidence Status

Implementation commits exist for R-01..R-11. An independent 2026-07-03 audit
confirmed the committed baseline passes typecheck, ESLint, Prettier, 70 Vitest
tests, browser build, OpenSpec strict validation, actionlint, npm audit, and one
local R-11 Supabase integration scenario. This does **not** certify those slices
as complete:

- all 11 archives lack committed verifier/reviewer reports;
- R-11 was archived with every task unchecked;
- required Deno and Playwright gates do not exist;
- database tests can return green without running when Supabase is unavailable;
- concrete security, RLS, delivery, queue, retention, SSRF, and ingestion defects
  are listed as R-11B..R-11I in `docs/roadmap.md`.

Historical files are not being rewritten to manufacture evidence. Each
remediation slice must pass all applicable static and behavioral gates plus a
fresh independent review on its final diff before archive.

R-11I added an executable OpenSpec hygiene guard so canonical specs cannot keep
placeholder purposes and future non-legacy archives cannot omit complete tasks
or checker reports.

## R-14 Maker Implementation Status (2026-07-04)

- Created OpenSpec change `r-14-delivery-workers`.
- Added migration `20260704183308_r14_delivery_workers.sql` with
  `enqueue_digest_delivery_attempts`, digest persistence handoff to
  `delivery-queue`, atomic delivery-claim helpers, delivery completion/failure
  acknowledgement RPCs, retry/backoff scheduling, channel failure counters, and
  integration circuit probe/failure/reset state.
- Extended `supabase/functions/work/index.ts` with delivery adapters for in-app,
  Brevo email, Telegram bot, Slack incoming webhook, and generic signed webhook
  delivery. Slack and generic webhook delivery use the shared SSRF helper
  immediately before requests, do not follow redirects, and generic webhooks
  send `X-News-Event-Id`, `X-News-Timestamp`, and `X-News-Signature`.
- Added `packages/browser/src/lib/delivery-worker.test.ts` and extended queue
  unit/integration coverage for provider payloads, HMAC signatures, redirect
  blocking, permanent failure acknowledgement, attempt creation, retry backoff,
  and circuit rows.
- Fixed the R-13 canonical `ai-processing-worker` spec purpose placeholder
  left by archive so OpenSpec hygiene tests remain truthful.
- Maker self-checks currently passed: focused R-14 Vitest, `npm run typecheck`,
  `npm run lint`, `npm run format`, `npm run test` (130 tests), `npm run
  deno:check`, `npm run deno:lint`, `npm run deno:fmt`, `npm run
  supabase:reset`, `npm run supabase:lint`, `npm run test:integration`, `npx -y
  @fission-ai/openspec@1.5.0 show r-14-delivery-workers`, and `npx -y
  @fission-ai/openspec@1.5.0 validate r-14-delivery-workers --strict`.
- First checker loop found blocking delivery state-machine defects. The current
  diff fixes duplicate delivered job acknowledgement, not-yet-due retry
  requeueing, and scoped retry classification for transport failures; both
  checker passes must be rerun on this final diff.
- Independent verifier PASS and reviewer APPROVE reports are retained in the
  archived OpenSpec change. R-15 feedback capture is next.

## R-15 Maker Implementation Status (2026-07-04)

- Created OpenSpec change `r-15-feedback-capture` with new `digest-feedback`
  capability requirements.
- Added authenticated `GET /digests` and `PUT /digests/:id/feedback` API routes
  that report only caller-owned retained digests, calculate feedback counts from
  that same result set, validate `thumbs_up`/`thumbs_down`/`none`, and update
  only `processed_digests.user_feedback`.
- Added a dashboard `Digests` tab with retained digest history, feedback counts,
  thumbs up/down toggle controls, and a clear action.
- Added browser API helper coverage and API route tests for report fetch,
  feedback update, clear-to-none, invalid feedback rejection, API error display,
  and cross-user not-found behavior.
- Maker checks currently passed: focused R-15 Vitest, `npm run typecheck`,
  `npm run lint`, `npm run format`, `npm run test` (140 tests),
  `npm run deno:check`, `npm run deno:lint`, and `npm run deno:fmt`.
- `npm run verify:local`, OpenSpec strict validation, and `git diff --check`
  passed on the final maker diff.
- Independent reviewer APPROVE is retained in the active OpenSpec change with
  no blocking findings and two non-blocking notes.
- Independent verifier PASS evidence is retained in the active OpenSpec change.
  Broader verifier agents repeatedly hung, so the report records bounded
  command evidence from separate tiny verifier sub-agent runs for focused tests,
  typecheck, OpenSpec strict validation, and `git diff --check`.
- Archived OpenSpec change `r-15-feedback-capture` at
  `openspec/changes/archive/2026-07-05-r-15-feedback-capture/`, creating the
  canonical `digest-feedback` spec.
- R-15 was committed as `10b5fe5` and passed GitHub `CI` and `CodeQL` on
  `main`.

## R-16 Closure (2026-07-05)

- Created OpenSpec change `r-16-lifecycle-cleanup`.
- Audited existing R-11F/R-11G/R-13/R-14 cleanup, queue, and schedule behavior
  against R-16 requirements.
- Added lightweight `queue-worker` regression coverage for 30-minute cleanup
  cadence, seven-day content purge, 30-day sanitized metadata retention,
  unresolved operational-event retention, active circuit preservation, exact
  sanitized DLQ context passed to `archive_exhausted_worker_job`, and no
  separate durable news-content storage or content-bearing queue payloads.
- Extended Supabase cleanup integration coverage so the local database executes
  cleanup and proves stale source-fetch, processing, and delivery leases are
  reset to pending with cleared lease fields.
- Maker checks currently passed: focused R-16 Vitest
  (`packages/browser/src/lib/queue-worker.test.ts`, 15 tests),
  `npm run typecheck`, `npm run lint`, `npm run format`, `npm run test` (145
  tests), `npm run deno:check`, `npm run deno:lint`, `npm run deno:fmt`,
  `npm run supabase:lint`, `npm run test:integration` (3 files, 5 tests),
  `npx -y @fission-ai/openspec@1.5.0 validate --all --strict`, and `git diff
  --check`.
- First independent reviewer pass requested changes because the initial R-16
  tests did not behaviorally prove stale lease recovery, DLQ context
  sanitization, or durable queue/cache posture. The final diff addressed those
  blockers.
- Independent verifier PASS and reviewer APPROVE reports are retained in the
  archived change. R-16 is archived as
  `openspec/changes/archive/2026-07-05-r-16-lifecycle-cleanup/`, creating the
  canonical `lifecycle-cleanup` spec and updating `scheduler-queue`.
- R-16 was committed as `3a9b7f3`, pushed to `origin/main`, and passed GitHub
  `CI` and `CodeQL`. R-17 observability is the active slice.

## R-17 Maker Implementation Status (2026-07-05)

- Created OpenSpec change `r-17-observability-guardrails`.
- Checked the Supabase changelog on 2026-07-05; no recent Edge Function,
  Postgres RPC, Cron, or `pgmq` breaking change affects this slice.
- Added migration `20260705102552_r17_observability_guardrails.sql` with a
  service-role-only `claim_operational_event_alert` RPC, a critical unresolved
  event alert index, a content-free `ai_usage_events` budget ledger,
  `get_ai_token_usage_since`, and a terminal processing failure RPC for budget
  exhaustion.
- Added structured, sanitized JSON logs for worker, scheduler, and cleanup
  invocations with correlation IDs and safe domain identifiers.
- Added worker alerting for critical DLQ events and provider quota events using
  Brevo operator email delivery with database-backed one-hour alert dedupe.
- Added configurable AI token guardrails (`AI_DAILY_TOKEN_BUDGET` and
  `AI_RESPONSE_TOKEN_BUDGET`) that fail closed before provider calls or before
  digest persistence when budgets are exhausted, count failed response usage,
  and acknowledge exhausted processing jobs terminally to avoid repeat spend.
- Added focused tests for sanitized correlated logs, alert dedupe/send behavior,
  alert-claim failure hardening, service-role-only observability RPCs, AI
  budget fail-closed paths, and malformed over-budget schema-repair bypass
  prevention.
- Maker checks currently passed: focused R-17 Vitest
  (`queue-worker.test.ts` and `processing-worker.test.ts`, 31 tests),
  `npm run typecheck`, `npm run lint`, `npm run format`, `npm run test` (152
  tests), `npm run deno:check`, `npm run deno:lint`, `npm run deno:fmt`, `npm
  run supabase:reset`, `npm run supabase:lint`, `npm run test:integration` (3
  files, 5 tests), `npm run verify:local`, `npx -y
  @fission-ai/openspec@1.5.0 validate --all --strict`, and `git diff --check`.
- First independent reviewer pass requested changes for a schema-repair budget
  bypass. The final diff checks OpenAI response usage before schema parsing or
  repair, records failed budget/provider usage, and terminally acknowledges
  budget-exhausted processing jobs.
- Fresh independent verifier PASS and reviewer APPROVE reports are retained in
  the archived change. R-17 is archived as
  `openspec/changes/archive/2026-07-05-r-17-observability-guardrails/`, creating
  the canonical `observability-guardrails` spec.
- R-17 was committed as `d24e00f`, pushed to `origin/main`, and passed GitHub
  `CI` run `28738906497` plus `CodeQL` run `28738906512`. R-18 is next.

## R-18 Maker Implementation Status (2026-07-05)

- Created OpenSpec change `r-18-dashboard-polish-e2e`.
- Scoped the slice to responsive dashboard polish, digest history, flow status,
  source warnings, and Playwright behavioral evidence.
- Confirmed the current authenticated browser UI still uses a dark/glass style,
  while `docs/DESIGN.md` specifies the light "Sophisticated Newsroom" system.
- Added the light newsroom authenticated shell, responsive overview tab, status
  ledger, digest/flow/source summaries, e2e-only authenticated fixture mode, and
  deterministic desktop/mobile Playwright coverage.
- Fixed the first independent reviewer blockers by reading all user-owned source
  links for overview warnings, deduplicating shared source links, making
  existing panel grid tracks mobile-safe, and extending mobile e2e to visit all
  authenticated tabs.
- Maker checks currently passed: focused dashboard Vitest
  (`dashboard-summary.test.ts`, 2 tests), `npm run typecheck`, `npm run lint`,
  `npm run format`, `npm run test` (154 tests), `npm run build:browser`,
  `npm run test:e2e` (3 Chromium tests), `npm run verify:local`,
  `npx -y @fission-ai/openspec@1.5.0 validate --all --strict`, and
  `git diff --check`.
- First independent reviewer pass requested changes for all-flow source warning
  coverage and mobile-safe existing panels. The final diff addressed both
  blockers and fresh independent verifier PASS and reviewer APPROVE reports are
  retained in the active change.
- R-18 is archived as
  `openspec/changes/archive/2026-07-05-r-18-dashboard-polish-e2e/`, creating the
  canonical `dashboard-responsive-ux` spec and updating `digest-feedback`,
  `flow-management`, and `source-management`.
- R-18 was committed as `0ab150d`, pushed to `origin/main`, and passed GitHub
  `CI` run `28740303146` plus `CodeQL` run `28740303150`. R-19 deploy config is
  active.

## R-19 Closure (2026-07-05)

- Created OpenSpec change `r-19-deploy-config-bootstrap` with new
  `deployment-bootstrap` requirements and a `cicd-security-gates` delta for the
  deployment audit gate.
- Checked current Vercel docs for repository-owned `vercel.json` project
  configuration, rewrites, and headers; checked current Supabase deployment and
  Edge Function deploy docs; checked the Supabase changelog on 2026-07-05. No
  relevant breaking item invalidates this config-only slice.
- Added root `vercel.json` for the Vite browser workspace with static-only SPA
  fallback, security headers, and asset/HTML cache headers.
- Added read-only `infra/scripts/audit-deployment.mjs` and
  `infra/scripts/bootstrap-check.mjs` commands. They validate committed config
  and print human-bootstrap actions without provider mutation or secret values.
- Added `npm run infra:audit` and `npm run infra:bootstrap-check`; CI now runs
  the deployment audit as part of the quality gate.
- Added focused Vitest coverage for audit secret-safety and Vercel static-only
  config shape.
- Maker checks currently passed: `npm run infra:audit`, `npm run
  infra:bootstrap-check`, focused deployment Vitest, `npm run typecheck`, `npm
  run lint`, `npm run format`, `npm run test` (14 files, 156 tests), `npm run
  build:browser`, actionlint for all workflows, `npm run verify:local`, `npx -y
  @fission-ai/openspec@1.5.0 validate r-19-deploy-config-bootstrap --strict`,
  `npx -y @fission-ai/openspec@1.5.0 validate --all --strict`, and `git diff
  --check`.
- Independent verifier PASS and reviewer APPROVE reports are retained in the
  archived change. The reviewer recorded one non-blocking follow-up to tighten
  the broad CSP `connect-src` after human bootstrap provides exact production
  origins.
- Archived `r-19-deploy-config-bootstrap`, creating the canonical
  `deployment-bootstrap` spec and updating `cicd-security-gates`.
- R-19 was committed as `ceaa367` and pushed to `origin/main`. GitHub `CI` run
  `28740803977` failed in `packages/browser/src/lib/crypto.test.ts` because the
  test tampered ciphertext with `replace(/a/g, 'b')`, which is a no-op when the
  random base64 ciphertext contains no `a`. Repair commit `fa0bf6f` flips a
  decoded ciphertext byte before re-encoding it; local focused/full unit tests,
  lint, format, and `git diff --check` passed. GitHub `CI` run `28740880409`
  and `CodeQL` run `28740880398` passed for the repair commit.

## R-13 Maker Implementation Status (2026-07-04)

- Created OpenSpec change `r-13-ai-processing-worker`.
- Added AI processing worker logic to claim new flow articles, reuse same-run
  claims on retry, group near-duplicates with n-gram Jaccard similarity,
  enforce 2,000-character per-article and 60,000-character total input budgets,
  call the OpenAI Responses API with strict structured output, persist one
  digest with usage/request/model metadata, and record `no_content` without a
  digest when there are no new candidates.
- Added a forward migration so transactional queue completion preserves
  `processing_runs.status = no_content` instead of overwriting it with
  `completed`, and so digest persistence plus current-run article inclusion
  happen in one service-role RPC transaction.
- The same migration now records `processing_enqueued_at`, enqueues one
  `processing-queue` message after all flow sources for a cycle are terminal
  through either successful or failed ingestion, and deletes undigested
  current-run claims when an exhausted processing job is archived.
- Added focused Vitest coverage in
  `packages/browser/src/lib/processing-worker.test.ts`.
- Added a retry regression so an already-persisted digest is reused if queue
  acknowledgement failed after digest persistence instead of rewriting the run
  as `no_content`; incomplete current-run article links are repaired before
  returning retry success.
- Added one bounded OpenAI schema repair request before malformed structured
  output fails the run.
- Fixed candidate selection to filter already-claimed flow articles before
  applying the 50-article cap, with a regression for older unclaimed articles
  behind 50 newer claimed articles.
- Maker self-checks currently passed: focused R-13 Vitest, `npm run
  typecheck`, `npm run lint`, `npm run format`, `npm run test` (120 tests), `npm run
  deno:check`, `npm run deno:lint`, and `npm run deno:fmt`.
- Independent verifier/reviewer passes are still pending on the final R-13 diff.

## Active Worktree Ownership

- `supabase/functions/deno.json`, `supabase/functions/work/index.ts`, and
  `packages/browser/src/lib/ingestion-worker.test.ts` are pre-existing
  Antigravity R-12 maker output under audit.
- `.codex/` is pre-existing generated skill content and is not part of R-11A.
- R-11A owns the roadmap case rename, audit OpenSpec, and state/process updates.
- R-11B is archived at `openspec/changes/archive/2026-07-03-r-11b-enforce-real-verification-gates/` and owns root gate scripts/config, Playwright smoke harness, Deno gate config/lock/update-check, integration-test split, CI gate expansion, and verification documentation updates.

## R-11B Archived Gate Status (2026-07-03)

Completed before the first checkpoint:

- `openspec validate r-11b-enforce-real-verification-gates --strict` passed.
- `npm run test` passed: 5 files, 67 tests.
- `npm run test:coverage` passed after narrowing the initial coverage scope to
  the backend helper modules currently under unit test.
- `npm run typecheck` passed.
- `npm run build:browser` passed.
- Deno lock generation succeeded with public registry access.

Updated after the CI repair checkpoint:

- GitHub `Lint Workflows` failure root cause was a stale pinned actionlint
  installer URL; the workflow now downloads the pinned `v1.7.12` release
  tarball directly.
- GitHub `CI` failure root cause was Deno Web Crypto `BufferSource` typing in
  `supabase/functions/api/crypto.ts`; encryption/decryption now pass
  `ArrayBuffer` values.
- User clarified that development should stay on `main`; `AGENTS.md` now
  records this repository policy.
- `npm run verify:local` passed, including typecheck, lint, Prettier, unit
  tests, coverage, Deno check/lint/format/lock, npm audit, browser build, and
  Playwright smoke e2e.
- `actionlint .github/workflows/actionlint.yml .github/workflows/ci.yml`
  passed.
- `npm run deno:outdated` exited 0; Deno reported that some package update metadata
  could not be fetched; this confirmed the command is an update-compatibility check rather than a security advisory scanner.
- GitHub `CI` later failed only in `npm run test:integration`. The failure was
  not actionable because the tests swallowed Supabase health/client/setup errors
  and rethrew a generic prerequisite message.
- The follow-up CI diagnostics patch now exports actual local Supabase status
  values into the CI environment, accepts `API_URL`/`SERVICE_ROLE_KEY`, waits up
  to 60 seconds for Auth health, and lets integration setup/admin errors fail
  with their real messages. CI also moved to Node 22 to match the current
  `@supabase/supabase-js` support warning.
- After that patch, local `npm run typecheck`, `npm run lint`, `npm run format`,
  `npm run test`, `actionlint .github/workflows/actionlint.yml
  .github/workflows/ci.yml`, and `git diff --check` passed.
- Local `npm run test:integration` failed in this sandbox with
  `connect EPERM 127.0.0.1:54321`; GitHub CI remains the required evidence for
  the Supabase-backed integration run.
- The first follow-up CI run for the diagnostics patch was cancelled by the next
  push while in `Start Supabase`. The workflow now bounds the job and Supabase
  runtime steps with explicit timeouts so future CI failures are visible instead
  of silently hanging.
- GitHub CI run `28681035556` for final R-11B documentation commit `f1d7354` passed all R-11B gates:
  npm install, typecheck, lint, format, unit tests, coverage, Deno
  check/lint/fmt/lock/update-check, npm audit, browser build, Playwright smoke,
  Supabase start/reset/status export, migration lint, integration tests, and
  Supabase stop. This supersedes earlier run `28679753122` for `a66230e`.
- `npm run deno:outdated` has been reclassified as a Deno dependency
  update/compatibility check, because `deno outdated --compatible` does not
  provide a security advisory scan.

Archive notes:

- `npm run test:integration` and `npm run supabase:lint` require a reachable
  local Supabase stack. GitHub CI has passed both; this sandbox still blocks
  localhost network access for local reruns.
- R-11B retained independent verifier PASS and independent reviewer APPROVE reports before archive.

## Verified Audit Findings

1. Custom prompts are stored as plaintext (`NFR-SEC-03`).
2. Delivery email identity, Telegram ownership, channel verification, and
   one-time webhook secret behavior contradict requirements.
3. Shared source/article RLS exposes global data too broadly.
4. Queue workers can acknowledge work after failed state commits.
5. Cleanup removes operational/run metadata on incorrect schedules.
6. SSRF validation has a DNS-resolution/fetch time-of-check gap.
7. R-12 lacks bounded extraction, publication filtering, transactional hashed
   dedupe, cycle-based source health, and runnable dependencies.
8. Canonical OpenSpec purposes and prior archive task/evidence hygiene are
   incomplete and require reconstruction without rewriting historical claims.

See `docs/roadmap.md` for the ordered corrective backlog.

## R-11A Checker Evidence

- The latest independent verifier report records all applicable
  documentation/configuration gates; npm/code and Playwright gates are recorded
  as not applicable to this documentation-only slice.
- The latest independent reviewer report records the final finding disposition.
- Durable `verification.md` and `review.md` reports live in the R-11A OpenSpec
  change directory and are retained when the change is archived.

## R-11C Archived Status (2026-07-03)

- Archived OpenSpec change `r-11c-encrypt-custom-prompts` at `openspec/changes/archive/2026-07-03-r-11c-encrypt-custom-prompts/`.
- Custom prompts are encrypted with shared AES-256-GCM helpers before storage; direct authenticated Data API grants exclude `prompt_template`; service-role API reads/updates are constrained by JWT-derived `user.id` before decryption.
- The greenfield migration nulls pre-R-11C local/dev plaintext custom prompts because no production data exists in this repository; a deployed product with real data would need a human-controlled runtime backfill before applying the column restriction.
- Independent verifier PASS and reviewer APPROVE reports are retained in the archived change. R-11D is next.


## R-11D Maker Implementation Status (2026-07-03)

- Created OpenSpec change `r-11d-repair-delivery-identity-secrets` for delivery identity and secret handling repairs.
- Email delivery channel create/update now derives the destination from the authenticated user's verified identity email and rejects unverified email identities.
- Telegram channel create/update now rejects user-supplied bot tokens; Telegram verification uses the application-owned runtime bot token.
- Channel verification now performs type-specific checks before activation instead of blindly setting `status = active`.
- Generic webhook signing secrets remain encrypted at rest and are returned in plaintext only in the mutation response that generated them; ordinary reads still mask the secret.
- Browser Telegram setup no longer collects bot tokens.
- Maker self-checks, independent verifier PASS, and independent reviewer disposition are retained before archive.


## R-11D Archived Status (2026-07-03)

- Archived OpenSpec change `r-11d-repair-delivery-identity-secrets` at `openspec/changes/archive/2026-07-03-r-11d-repair-delivery-identity-secrets/`.
- Email channels derive destinations from verified authenticated identity emails; unverified email identities are rejected.
- Telegram channels reject user-supplied bot tokens and use the app-owned runtime bot for verification.
- Channel verification is type-specific and fails closed before constrained activation.
- Generic webhook signing secrets are encrypted, disclosed only when generated, masked on ordinary reads, and preserved on URL updates.
- Independent verifier PASS and reviewer APPROVE reports are retained in the archived change. R-11E is next.


## R-11E Maker Implementation Status (2026-07-03)

- Created OpenSpec change `r-11e-restrict-shared-source-article-rls`.
- Added a migration to replace broad authenticated reads on `global_sources` and `ingested_articles` with owned-flow-link policies.
- Added policy-shape tests for the R-11E migration and synced the canonical `core-schema-rls` spec.
- Independent verifier PASS and reviewer APPROVE reports are retained in the archived change.


## R-11E Archived Status (2026-07-03)

- Archived OpenSpec change `r-11e-restrict-shared-source-article-rls` at `openspec/changes/archive/2026-07-03-r-11e-restrict-shared-source-article-rls/`.
- `global_sources` no longer has broad authenticated read access; users can read only sources linked to their owned flows.
- `ingested_articles` no longer has broad authenticated read access; users can read only articles claimed by their owned flows.
- Existing service-role access remains the worker path for shared cache operations.
- Independent verifier PASS and reviewer APPROVE reports are retained in the archived change. R-11F is next.

## R-11F Maker Implementation Status (2026-07-03)

- Created OpenSpec change `r-11f-repair-queue-ack` for queue acknowledgement repairs.
- Added transactional service-role RPCs so worker success commits domain state and queue acknowledgement together, with fail-closed claim/ack/archive error handling.
- Updated the `work` Edge Function to use schema-correct delivery attempt states (`sending`, `delivered`, `failed`) and `error_message`.
- Added worker regression tests for transactional completion, claim RPC failure, and DLQ ordering.
- Maker checks, independent review approval, and independent verification with environment-limited Supabase gates were retained in the active change before the final repair pass.

## R-11F Archived Status (2026-07-04)

- Archived OpenSpec change `r-11f-repair-queue-ack` at `openspec/changes/archive/2026-07-04-r-11f-repair-queue-ack/`.
- Local Supabase was reset successfully and replayed migrations through the R-11F transactional acknowledgement migration.
- `npm run supabase:lint` passed with no schema errors, resolving the previous local Supabase/Postgres unavailable warning.
- `npm run test:integration` passed with 2 integration files and 3 tests, resolving the previous local Supabase health warning.
- `npx -y @fission-ai/openspec@1.5.0 show/validate r-11f-repair-queue-ack` passed, resolving the previous ambiguous `npx openspec` executable warning.
- Legacy queue helper RPCs now reject unsupported queue names before calling `pgmq`, and the queue worker regression suite covers this safety boundary.
- Independent verifier PASS and reviewer APPROVE reports are retained in the archived change. R-11G is next.

## R-11G Maker Implementation Status (2026-07-04)

- Created OpenSpec change `r-11g-retention-metadata-lifecycle`.
- Added a cleanup migration that keeps seven-day deletion focused on content-bearing articles, digests, and delivery attempts; retains source/processing run metadata for 30 days; deletes only resolved operational events older than 30 days; and deletes only closed stale integration circuits.
- Added Supabase integration coverage for expired content deletion, 20-day run metadata retention, unresolved operational-event retention, resolved metadata deletion, and open/closed circuit lifecycle behavior.
- Disabled file-level parallelism only for Supabase integration tests because they share one local database and existing tests truncate shared tables.
- Maker gates passed: `npm run supabase:reset`, `npm run supabase:lint`, `npm run test:integration`, `npm run typecheck`, `npm run lint`, `npm run format`, `npx -y @fission-ai/openspec@1.5.0 validate r-11g-retention-metadata-lifecycle --strict`, and `git diff --check`.
- R-11G was ready for independent verifier and reviewer passes.

## R-11G Archived Status (2026-07-04)

- Archived OpenSpec change `r-11g-retention-metadata-lifecycle` at `openspec/changes/archive/2026-07-04-r-11g-retention-metadata-lifecycle/`.
- Cleanup now applies seven-day deletion to content-bearing articles, digests, and delivery attempts, while retaining sanitized source/processing run metadata for 30 days.
- Cleanup now retains unresolved operational events, deletes only resolved events older than 30 days, retains open/half-open integration circuits, and deletes only closed stale circuits.
- Supabase integration tests now run sequentially because they share one local database.
- Independent verifier PASS and reviewer APPROVE reports are retained in the archived change. R-11H is next.

## R-11H Maker Implementation Status (2026-07-04)

- Created OpenSpec change `r-11h-harden-outbound-ssrf`.
- Added `fetchWithSsrfProtection()` and `assertUrlSsrfSafe()` to validate outbound URLs immediately before fetch, disable native redirects, and manually revalidate permitted redirects.
- Routed Slack and generic webhook verification requests through the protected fetch helper with redirects disabled.
- Added SSRF regression tests for DNS rebinding-style resolver changes, unsafe redirect targets, safe relative redirects, and redirect blocking when redirects are disabled.
- Maker gates passed: `npm run test -- packages/browser/src/lib/ssrf.test.ts`, `npm run typecheck`, `npm run lint`, `npm run format`, `npm run deno:check`, `npx -y @fission-ai/openspec@1.5.0 validate r-11h-harden-outbound-ssrf --strict`, and `git diff --check`.
- R-11H is maker-complete but not archived. Multiple independent verifier/reviewer sub-agent attempts hung without returning artifacts, even after explicit status/partial-result prompts, so R-11H remains `in-progress` until fresh checker passes complete.

## Local Runtime Repair Status (2026-07-06)

- Started local Supabase and browser development services for interactive testing.
- Repaired the API Edge Function local boot path by adding the missing Supabase JS import map entries used by function imports.
- Switched the API Edge Function wrapper to accept verified user JWTs, while keeping health routing public through the existing handler-level guard.
- Repaired API route normalization for the local Edge Runtime `/api/...` request path, in addition to hosted `/functions/v1/api/...` paths.
- Added regression coverage for the local `/api/profiles` route prefix.
- Verified `GET /functions/v1/api/profiles` returns `200 OK` for a real local authenticated user.
