## Context

R-01..R-11 added the Node workspace, browser app, Supabase migrations, Edge
Functions, CI, and initial tests. The existing gates exercise npm typecheck,
ESLint, Prettier, and Vitest, but the independent audit found four release
blockers in the verification surface:

- Supabase Edge Functions are Deno programs, yet no committed gate checks Deno
  type resolution, linting, formatting, lock integrity, or dependency update check.
- Browser behavior is not exercised by Playwright even though T-12 requires it.
- Backend coverage is not enforced, so worker/API regressions can merge while
  tests remain green.
- Local Supabase integration tests can return without assertions when the
  emulator is unavailable, creating false-positive evidence.

The paused R-12 ingestion draft is intentionally out of scope. R-11B must be
implemented so staged/committed verification can be evaluated independently of
that unrelated dirty worktree state.

## Goals / Non-Goals

**Goals:**

- Make every documented verification family executable through root scripts and
  CI: Node static gates, Deno gates, browser build/smoke behavior, backend
  coverage, dependency update checking, migration linting, and local integration.
- Ensure integration prerequisites are explicit and fail visibly instead of
  silently skipping tests.
- Keep all gates reproducible with pinned or lockfile-backed dependencies.
- Preserve existing R-12 draft files without staging or relying on them.

**Non-Goals:**

- Do not fix product defects discovered by the audit in prompts, delivery,
  queue state transitions, RLS, retention, SSRF, or ingestion.
- Do not require paid services, deploys, hosted provider settings, or external
  accounts.
- Do not claim hosted GitHub secret scanning or branch-protection state from
  local files.

## Decisions

1. **Use root npm scripts as the stable local/CI contract.** Root scripts will
   wrap Deno, Playwright, Supabase, and coverage gates so AGENTS.md, CI, and
   checker agents run the same commands. Alternative: document direct tool
   invocations only. Rejected because it fragments evidence and makes CI drift.

2. **Install Deno through CI setup and keep local scripts tool-agnostic.** Local
   scripts call `deno` directly, while GitHub Actions installs a pinned Deno
   major before running them. Alternative: rely on Supabase CLI's embedded Deno.
   Rejected because it does not provide a direct `deno check/lint/fmt` contract.

3. **Commit a shared Edge Function lockfile.** Deno dependency resolution for
   `supabase/functions/**` will be locked and checked with `--frozen` in CI.
   Alternative: no lockfile because most imports are local. Rejected because
   R-12+ introduces external feed/readability dependencies and must not start
   from an unlocked baseline.

4. **Separate unit tests from local integration tests.** Unit/coverage runs must
   not depend on the Supabase emulator. Integration tests run through a distinct
   script that checks `supabase status` first and exits non-zero with setup
   instructions when prerequisites are missing. Alternative: Vitest `skip` when
   unavailable. Rejected because skips were the audited false-positive.

5. **Add a minimal Playwright smoke test before broader UX tests.** The first
   behavioral gate proves the built Vite app serves and renders deterministic
   shell content. Later feature slices add deeper flows. Alternative: wait for
   R-18 dashboard polish. Rejected because T-12 already requires an executable
   e2e harness before further runtime changes.

6. **Enforce realistic coverage on backend-facing test scope.** Coverage will
   include browser-side API helpers and imported Edge Function helpers that run
   under Vitest, with thresholds high enough to prevent accidental zero coverage
   but not so high that R-11B must rewrite product tests unrelated to the gate.
   Later remediation slices can raise thresholds as they add tests.

## Risks / Trade-offs

- **CI runtime increases** -> Keep Playwright to Chromium smoke and run
  integration only after explicit local-stack setup in CI.
- **Deno unavailable locally** -> Scripts fail with a clear missing-tool error;
  CI installs Deno so hosted verification is deterministic.
- **Unrelated R-12 dirty files break root gates** -> Stage and verify only the
  R-11B diff; preserve R-12 draft unstaged until its own slice.
- **Supabase local stack unavailable on a developer machine** -> Integration
  gate fails visibly with instructions instead of returning green.

## Migration Plan

1. Add R-11B scripts/config/tests and update CI.
2. Generate/update Deno and npm lockfiles as needed.
3. Run the new gates locally where tools are available; document unavailable
   external prerequisites as failures, not passes.
4. Archive the OpenSpec change only after independent verification and review.
5. Rollback is a normal git revert of scripts/config/tests if a gate proves
   unsound before subsequent remediation slices depend on it.

## Open Questions

- Hosted GitHub repository settings such as push-protection and branch
  protection remain human-audited bootstrap items; local files cannot prove
  provider state.
