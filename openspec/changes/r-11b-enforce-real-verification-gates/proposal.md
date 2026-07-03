## Why

The committed pipeline verifies only Node-side code while Supabase Edge
Functions, browser behavior, backend coverage, and local integration
prerequisites can escape or falsely pass the gate. R-11B makes the documented
T-12/T-13 and Q-01..Q-05 quality contract executable before further worker
changes build on an unreliable baseline.

## What Changes

- Add pinned, reproducible Deno check, lint, format, dependency-lock, and audit
  gates for every Edge Function entry point and shared module.
- Add backend unit-test coverage with an enforced threshold for Edge Function
  code that can run without external services.
- Add a minimal Playwright harness and deterministic browser smoke scenario
  that proves the production build starts and renders.
- Split local Supabase integration tests into an explicit gate that fails with
  actionable prerequisite output when the stack is unavailable; unit tests no
  longer silently skip integration behavior.
- Run the new gates in CI with pinned setup/actions and retain the existing
  Node, security, and formatting checks.
- Update repository instructions and state/process records only after the gates
  are runnable and verified.
- Non-goals: fixing queue semantics, RLS, prompts, delivery channels, retention,
  SSRF, or the paused R-12 ingestion implementation.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `cicd-security-gates`: expand continuous verification to cover Deno Edge
  Functions, dependency integrity/auditing, backend coverage, Playwright browser
  behavior, and explicit local-integration prerequisites.

## Impact

Affected areas include root scripts and dependencies, Deno configuration and
lockfiles, Vitest/coverage configuration, Playwright configuration and smoke
tests, local Supabase integration tests, GitHub Actions, repository verification
guidance, and audit state records. The change satisfies T-12, T-13, Q-01..Q-05,
NFR-OPS-04, and AT-01/AT-11.
