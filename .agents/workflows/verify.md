---
description: Independently verify the current change by running the real gates in a separate sub-agent.
---

# /verify — independent verification (separate sub-agent)

Confirm a change actually works, independently of whoever wrote it. This is a
checker step: **spawn a new sub-agent in a fresh context** so the verifier is
separate from the maker (`.agent/rules/20-maker-checker.md`).

**Input (optional):** a change name. Default to the active change.

## Steps

1. **Spawn a verifier sub-agent.** Instruct it to run the **verify-change**
   skill. Give it only the change's acceptance criteria and the diff
   (`git diff`) — not the maker's self-assessment.
2. The sub-agent:
   - discovers which gates actually exist (`package.json` scripts, `deno.json`,
     `supabase/`, `.github/workflows/`, installed CLIs);
   - runs the applicable gates from `.agent/rules/30-verification-gates.md`
     (`tsc`/`deno check`, lint, format, Vitest, Playwright, migration validate,
     `npm audit`, `actionlint`, CodeQL/Dependency Review results);
   - exercises the real behavior where feasible (endpoint/worker against mocks),
     including the failure path;
   - reports a gate table (gate → command → pass/fail/not-run → evidence) and a
     PASS/FAIL verdict.
3. **Act on the verdict.**
   - PASS → proceed to `/review`.
   - FAIL → return the exact commands, errors, and smallest repro to the maker;
     after a fix, re-run `/verify` on the **new** diff.

## Guardrails

- Run only gates that exist; "not run" is never "passed."
- The verifier observes and reports; it does not edit code.
