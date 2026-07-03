# R-11B Verification Evidence

## Current maker-run evidence

Date: 2026-07-03

This file records observed gate evidence for the active R-11B change and the
independent verifier pass retained for the final diff before archive.

### Passing local gates

- `openspec validate r-11b-enforce-real-verification-gates --strict` — passed.
- `actionlint .github/workflows/actionlint.yml .github/workflows/ci.yml` —
  passed.
- `npm run verify:local` — passed after the CI repair checkpoint, including
  typecheck, lint, format, unit tests, coverage, Deno check/lint/fmt/lock,
  `npm audit`, browser build, and Playwright smoke e2e.
- After the Supabase integration CI-diagnostics patch:
  - `npm run typecheck` — passed.
  - `npm run lint` — passed.
  - `npm run format` — passed.
  - `npm run test` — passed: 5 files, 67 tests.
  - `actionlint .github/workflows/actionlint.yml .github/workflows/ci.yml` —
    passed.
  - `git diff --check` — passed.

### Local Supabase integration result

- `npm run test:integration` — failed in this sandbox because outbound localhost
  access to `127.0.0.1:54321` is denied (`connect EPERM 127.0.0.1:54321`).
  This is a local execution-environment limitation, not a successful integration
  result.

### Hosted CI evidence

- GitHub Actions run `28681035556` for final R-11B documentation commit
  `f1d7354` passed:
  `npm ci`, Playwright browser install, typecheck, lint, format, unit tests,
  coverage, Deno check/lint/format, Deno dependency integrity/update check,
  `npm audit`, browser build, Playwright smoke e2e, Supabase start, Supabase
  database reset, Supabase local status export, Supabase migration lint,
  Supabase integration tests, and Supabase stop. This supersedes earlier run
  `28679753122` for `a66230e` because the final evidence commit is `f1d7354`.

### Deno dependency check naming

- `npm run deno:outdated` executes `deno outdated --lock deno.lock --frozen
  --compatible`. Direct command inspection confirmed this is a lockfile-backed
  dependency update/compatibility check, not a security advisory scanner. R-11B now
  reserves vulnerability audit language for `npm audit` and GitHub dependency
  review, and names the Deno gate as a dependency update check.

### Independent verifier report

- Final independent verifier report: retained in this file after the final local
  checker pass.
- Final independent reviewer report: retained in `review.md`.


## Independent verifier attempts

### Attempt 1 — FAIL

The verifier passed `git diff --check`, `npm run deno:outdated`, executable
script inspection, CI naming inspection, and final HEAD/CI citation inspection,
but failed the stale-terminology scan because the proposal and roadmap still
used misleading Deno audit wording.

### Attempt 2 — FAIL

The verifier passed `git diff --check`, `npm run deno:outdated`, and the
stale-terminology scan, but failed final state/process/spec coherence because
state and process still cited older CI evidence, the delta spec named
`deno:format` instead of `deno:fmt`, and the Dependabot scenario overclaimed
daily GitHub Actions checks.

### Attempt 3 — PASS

The independent verifier passed `git diff --check`, `npm run deno:outdated`,
`npx -y @fission-ai/openspec@1.5.0 validate r-11b-enforce-real-verification-gates --strict`,
the stale Deno audit terminology scan, final HEAD/CI evidence inspection, and
stale missing-report scans. No blocking findings remained.
