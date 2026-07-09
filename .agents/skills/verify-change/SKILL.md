---
name: verify-change
description: VERIFIER role, run by a sub-agent separate from the maker. Run the real verification gates for a change and observe behavior, then report a pass/fail table with evidence. Use to independently confirm a change actually works before review/archive. Does not fix code.
metadata:
  role: checker
  version: "1.0"
---

# Skill: Verify a change (independent Verifier)

## Objective

Independently confirm that a change **actually works** by running the real
gates and observing behavior — not by reading the diff and agreeing with the
maker. You are a separate sub-agent from the maker
(`.agent/rules/20-maker-checker.md`). You report evidence; you do not edit code.

## Rules of engagement

- Start from "prove this is broken." Do not read or trust the maker's
  self-assessment as evidence.
- Run **only gates that exist** right now (script in `package.json`, config
  present, CLI installed). Never claim a command you did not run. "Not run" is
  never "passed."
- Run the narrowest relevant gates for the diff first, then the fuller suite.
- Keep the working tree clean — you observe, you do not fix. File findings for
  the maker instead.

## Instructions

1. **Scope.** Identify the change and its acceptance criteria from
   `openspec show <name>` and `tasks.md`. Get the diff (`git diff`).
2. **Discover gates.** Inspect `package.json` scripts, `deno.json`,
   `supabase/`, `.github/workflows/`, and which CLIs are installed. Build the
   list of runnable gates from `.agent/rules/30-verification-gates.md`.
3. **Run gates** (as available):
   - `tsc --noEmit`, `deno check`
   - ESLint / `deno lint` (zero warnings), `prettier --check` / `deno fmt --check`
   - Vitest unit/integration (watch for concurrency, retry, idempotency,
     error/abuse-path tests); Playwright for critical/responsive flows
   - migration validate/lint against local Supabase
   - `npm audit`, `actionlint`, and CodeQL/Dependency Review results if present
4. **Behavioral check.** Where feasible, exercise the actual behavior the change
   claims (e.g. hit the endpoint, run the worker against a mock feed/OpenAI/
   webhook receiver, confirm a digest is produced or a `no_content` result is
   recorded). Confirm the requirement's scenarios, including the failure path.
   For UI/API changes, delegate end-to-end behavior to the **verify-e2e** skill
   (Playwright CLI + committed verification artifact); this static pass and the
   e2e pass together form the verification gate.
5. **Docs-only changes.** Run `git diff --check`, validate links/paths, and
   check requirement/decision traceability and stale terminology.
6. **Report.** Emit a table and a verdict.

## Output

A verifier report:

| Gate | Command | Result | Evidence |
|------|---------|--------|----------|
| ...  | ...     | pass/fail/not-run | short quote of output or test name |

Plus:
- **Verdict:** PASS (all applicable gates green + scenarios observed) or FAIL.
- For each failure: the exact command, the error, and the smallest repro.
- Explicit list of gates that do **not** exist yet (so they are not mistaken
  for passing).
