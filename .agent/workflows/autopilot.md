---
description: Autonomously build the whole project - decompose, then run the spec-driven maker/checker cycle slice by slice until done, unattended.
---

# /autopilot — build the project unattended

Drive the project to completion **without waiting for a human**, one roadmap
slice at a time, keeping every quality bar. Binding: `AGENTS.md` and all
`.agent/rules/` — especially `50-autonomous-operation` (decide, don't wait;
safety rails; stop conditions), `20-maker-checker`, `30-verification-gates`,
`40-security-and-secrets`.

**Input (optional):** a phase or slice id to start from, or a max number of
slices to build this run. Default: build every `pending` slice until done or
blocked.

## 0. Set up the run (once)

- Ensure you are on the `main` branch.
- Ensure the backlog exists: if `docs/roadmap.md` has no slices, run
  `/decompose` first.
- Read `docs/roadmap.md`, `openspec list`, and `openspec status` to find state.

## 1. Select the next slice

- Pick the first slice with status `pending` whose dependencies are all `done`.
- If none are runnable: go to **Stop** (all remaining are blocked or need human
  bootstrap).
- Mark it `in-progress` in `docs/roadmap.md`. Announce the slice + upstream IDs.
- If the slice needs a human-bootstrap item (account/secret/spend/deploy) to be
  *implemented* (not just deployed), mark it `blocked` with the reason and skip
  to the next runnable slice.

## 2. Plan (spec-first)

- `/opsx:propose "<slice>"` → `proposal.md`, delta `specs`, `design.md`,
  `tasks.md`. Cite upstream IDs; list non-goals. `openspec validate <name>`.
- Resolve any ambiguity from the architecture docs and record the decision in
  `design.md` — do not prompt the human.

## 3. Implement (MAKER)

- Run the **implement-change** skill (`/opsx:apply`): implement tasks with tests
  alongside code; keep `tasks.md` current. Use the installed tech skills
  (`supabase`, `supabase-postgres-best-practices`, `frontend-design`) and
  `context7` MCP for library docs. Scaffold any new gate and add it to the
  `AGENTS.md` Verification section.
- Produce a maker handoff summary. Do **not** self-verify or self-approve.

## 4. Verify (SUB-AGENTS, separate from maker) — hard gate

Spawn separate sub-agents (fresh contexts), passing only acceptance criteria +
`git diff`:

1. **Static gate — verify-change:** run the real gates that exist
   (`tsc`/`deno check`, lint, format, Vitest, migration validate, `npm audit`,
   `actionlint`). Returns a gate table + PASS/FAIL.
2. **Behavioral gate — verify-e2e:** drive the app with the **Playwright CLI**
   against the change's scenarios and emit the verification artifact
   (`openspec/changes/<name>/verification.md` + report/screenshots). Returns
   PASS/FAIL. (Skip only for changes with no runnable behavior yet, e.g. pure
   scaffold — say so explicitly.)

If either gate FAILS → return findings to the maker (step 3), fix, and re-run
**both** gates on the new diff. After 3 failed full attempts on the same slice,
mark it `blocked` with the reason and move on.

## 5. Review (SUB-AGENT, separate from maker and verifiers)

- Run **review-change** in another fresh sub-agent: independent review vs
  requirements, security, correctness, data lifecycle, cost, tests.
- Blocking findings → back to the maker (step 3), then re-run verify **and**
  review on the final diff.

## 6. Archive, record, commit

Only when both gates are green AND review has no unresolved blocking findings:

- `openspec validate <name> --strict`, then `/opsx:archive`.
- Mark the slice `done` in `docs/roadmap.md` and link the archived change.
- Update `docs/development_process.md` (decisions, gates run + evidence, files,
  findings, unresolved work; done vs planned).
- Commit on the `main` branch citing requirement IDs. **Do not deploy** —
  those are human-gated.

## 7. Continue

- Emit a one-line status (slice done / IDs / gates green / next).
- **Immediately return to step 1** for the next slice — do not wait for the user.
- Repeat until every slice is `done`, only `blocked` slices remain, or the
  optional slice cap for this run is reached.

## Stop and report

When you stop, write a status report: slices shipped this run, slices blocked
and why, and the "Human bootstrap required" items needed to unblock.
Never fabricate a passing gate to keep going.

## Guardrails (from `50-autonomous-operation`)

- No secrets/`.env`/state committed; commit directly to `main` without pushing to origin; no force-push,
  no auto-merge, no deploy, no spend, no external account creation.
- Never weaken gates/RLS/SSRF/encryption to pass. Maker≠checker always holds.
- One slice per cycle; decide from the docs instead of prompting.
