# Agent State

## Current Position

- **Last completed stage**: R-11A (`audit-state-and-verification-evidence`)
- **Active implementation slice**: R-11B (real Deno/Playwright/integration gates)
- **Current checkpoint**: R-11B is a WIP checkpoint requested for commit/push,
  not an archived or independently verified stage.
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
- R-11B WIP owns root gate scripts/config, Playwright smoke harness, Deno gate
  config/lock, integration-test split, CI gate expansion, and verification
  documentation updates. It remains unarchived until independent verifier and
  reviewer artifacts pass on the final diff.

## R-11B WIP Gate Status (2026-07-03)

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
- `npm run deno:audit` exited 0; Deno reported that some package update metadata
  could not be fetched, but no failing vulnerability result was returned.
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
- The first follow-up CI run for the diagnostics patch passed all non-Supabase
  gates through Playwright smoke, then remained in `Start Supabase` for several
  minutes without logs. The workflow now bounds the job and Supabase runtime
  steps with explicit timeouts so future CI failures are visible instead of
  silently hanging.

Remaining before R-11B can be archived:

- `npm run test:integration` and `npm run supabase:lint` require a reachable
  local Supabase stack. GitHub CI is expected to provide the next authoritative
  result because this sandbox blocks localhost network access.
- No R-11B independent verifier/reviewer reports exist yet, and the change is
  not archived.

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
