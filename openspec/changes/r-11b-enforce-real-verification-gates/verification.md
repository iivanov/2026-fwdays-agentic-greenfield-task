# R-11B Verification Evidence

## Current maker-run evidence

Date: 2026-07-03

This file records observed gate evidence for the active R-11B change. It is not
an independent verifier report yet; R-11B remains unarchived until a separate
checker pass and review are retained on the final diff.

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

### CI evidence still required

- GitHub Actions run `28679753122` for commit `a66230e` passed:
  `npm ci`, Playwright browser install, typecheck, lint, format, unit tests,
  coverage, Deno check/lint/format, Deno dependency integrity/audit,
  `npm audit`, browser build, Playwright smoke e2e, Supabase start, Supabase
  database reset, Supabase local status export, Supabase migration lint,
  Supabase integration tests, and Supabase stop.
- A separate verifier report and separate reviewer report are still required
  before archive.
