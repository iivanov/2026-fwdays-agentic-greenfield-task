---
description: Independently verify the current change by running the real gates in a separate sub-agent.
argument-hint: "[change name]"
---

# /verify — independent verification (separate sub-agent)

Confirm a change actually works, independently of whoever wrote it.

Target change: **$ARGUMENTS** (default: the active change).

## Steps
1. **Launch a separate sub-agent with the Agent tool** (`general-purpose`) — a
   fresh context distinct from the maker (`.agent/rules/20-maker-checker.md`).
   Instruct it to run the **verify-change** skill (it may also use the built-in
   `/verify` skill). Pass it only the acceptance criteria and `git diff` — not
   the maker's self-assessment.
2. The sub-agent:
   - discovers which gates exist (`package.json` scripts, `deno.json`,
     `supabase/`, `.github/workflows/`, installed CLIs);
   - runs the applicable gates from `.agent/rules/30-verification-gates.md`
     (`tsc`/`deno check`, lint, format, Vitest, Playwright, migration validate,
     `npm audit`, `actionlint`, CodeQL/Dependency Review results);
   - exercises the real behavior where feasible, including the failure path;
   - reports a gate table (gate → command → pass/fail/not-run → evidence) + a
     PASS/FAIL verdict.
3. **Act:** PASS → proceed to `/review`. FAIL → return exact commands, errors,
   and smallest repro to the maker; after the fix re-run `/verify` on the new
   diff.

## Guardrails
Run only gates that exist ("not run" ≠ "passed"); the verifier observes and
reports, it does not edit code.
