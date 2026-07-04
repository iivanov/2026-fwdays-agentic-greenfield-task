# Agent State

## Current Position

- **Last completed stage**: R-11E (`r-11e-restrict-shared-source-article-rls`)
- **Active implementation slice**: R-11F (queue transactional acknowledgement repair)
- **Current checkpoint**: R-11E is archived locally with retained verifier/reviewer reports; R-11F is next.
- **Paused draft**: R-12 ingestion worker; existing uncommitted maker output is preserved but fails current gates and requires a revised spec.
- **Loop mode**: autopilot on `main`; user explicitly requested a commit and
  push checkpoint on 2026-07-03. No deploy/spend/account creation.

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
- Maker checks, independent review approval, and independent verification with environment-limited Supabase gates are retained in the active change. R-11F is not archived because Supabase-backed migration/integration evidence could not run in this environment.
