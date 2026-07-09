---
trigger: always_on
description: Run only real verification gates, report exactly which ran, keep AGENTS.md in sync.
---

# Rule: Verification gates are real, not assumed

Verification means running commands and observing results — never "looks
correct." Report exactly which checks ran and their outcome.

## Reality first

The application is scaffolded incrementally. At any moment, run **only the
gates that actually exist** (a script in `package.json`, a config file present,
a CLI installed). Never invent or claim a command that is not wired up.

When a new gate becomes runnable, add it to the **Verification** section of the
root `AGENTS.md` in the same change that introduced it — that section is the
canonical, honest list of what can be run.

## Target gate set (from `Q-01..Q-05`, `T-12`, `T-13`)

Enable and enforce these as they come online:

- Types: `tsc --noEmit` (browser/shared) and `deno check` (Edge Functions).
- Lint (zero warnings): ESLint + `typescript-eslint`; `deno lint`.
- Format: `prettier --check`; `deno fmt --check`.
- Tests: Vitest (unit/integration incl. concurrency, retry, idempotency);
  Playwright for critical/responsive e2e. Backend coverage target ≥ 80%.
- DB: validate/lint migrations against local Supabase.
- Security/supply chain: CodeQL (`security-extended`), Dependency Review,
  `npm audit`, secret scan, `actionlint` for workflows.

## Rules

- Run the **narrowest** relevant gates for the diff, then the fuller suite
  before archiving a change.
- High/critical security or dependency findings are merge blockers. Lower
  severity needs a documented disposition, never silent dismissal.
- For documentation-only changes: `git diff --check`, validate links/paths, and
  check requirement/decision traceability and stale terminology.
- The verifier sub-agent reports a table: gate → command → pass/fail → evidence.
  If a gate could not run, say so explicitly; do not treat "not run" as "passed."
