---
name: autopilot
description: Autonomously build the entire project end to end without human intervention - decompose requirements into a backlog, then run the spec-driven maker/checker loop per slice (propose, implement, verify with static gates + Playwright, independent review), pass the verification gate, and continue to the next slice until done. Use to start or resume the unattended build. CLI-friendly alias of the /autopilot workflow.
metadata:
  role: orchestrator
  version: "1.0"
---

# Skill: Autopilot (unattended build loop)

## Objective

Drive the project to completion without waiting for a human, one roadmap slice
at a time, keeping every quality bar. This is the skill form of
`.agent/workflows/autopilot.md` so it is discoverable in the Antigravity CLI via
`/skills`. Binding: `AGENTS.md` and all `.agent/rules/` - especially
`50-autonomous-operation` (decide, don't wait; safety rails; stop conditions),
`20-maker-checker`, `30-verification-gates`, `40-security-and-secrets`.

## Rules of engagement

- Decide from the docs (`docs/architecture/`, `openspec/config.yaml`,
  `docs/roadmap.md`); never pause for interactive prompts mid-loop.
- Keep maker != checker even unattended: implement, verify, and review run as
  three separate sub-agents in fresh contexts.
- Safety rails: work only on branch `autopilot/build`; never commit/push to
  `main`, never force-push, never auto-merge, never deploy, never spend, never
  create external accounts, never commit secrets, never weaken a gate/RLS/SSRF
  check to pass.
- One slice per cycle; keep `docs/roadmap.md` statuses and `tasks.md` current.

## Instructions

1. **Set up (once).** Create/switch to branch `autopilot/build`. If
   `docs/roadmap.md` has no slices, run the `decompose-requirements` skill first.
   Read `docs/roadmap.md`, `openspec list`, `openspec status`.
2. **Select** the first slice with status `pending` whose dependencies are all
   `done`. None runnable -> go to Stop. If it needs a human-bootstrap item to be
   implemented, mark it `blocked` and pick the next. Mark the pick `in-progress`.
3. **Plan (spec-first).** `/opsx:propose "<slice>"` -> proposal, delta specs,
   design, tasks; cite upstream IDs; `openspec validate <name>`. Record any
   decision in `design.md`.
4. **Implement (maker).** Use the `implement-change` skill (`/opsx:apply`):
   tests alongside code; keep `tasks.md` current; use the `supabase`,
   `supabase-postgres-best-practices`, `frontend-design` skills and context7 MCP.
   Produce a maker handoff summary; do not self-verify or self-approve.
5. **Verify gate (separate sub-agents).** Spawn a sub-agent for `verify-change`
   (static gates that exist) and a sub-agent for `verify-e2e` (Playwright CLI +
   committed `openspec/changes/<name>/verification.md` artifact). Either FAIL ->
   return findings to the maker, fix, re-run both on the new diff. After 3 failed
   full attempts on a slice, mark it `blocked` and move on.
6. **Review (separate sub-agent).** Run `review-change`. Blocking findings ->
   back to the maker, then re-run verify AND review on the final diff.
7. **Archive + record.** Only when both gates are green and review has no
   unresolved blocking findings: `openspec validate <name> --strict`,
   `/opsx:archive`, mark the slice `done` in `docs/roadmap.md`, update
   `docs/development_process.md`, commit on `autopilot/build` citing requirement
   IDs, open/refresh a PR. Do not merge to `main` and do not deploy.
8. **Continue.** Emit a one-line status and immediately return to step 2 for the
   next slice. Repeat until all slices are `done` or only `blocked` remain.

## Stop and report

Stop when every remaining slice is `blocked`, a human-bootstrap item is required,
a slice failed verification 3 times, or a requirement is genuinely
contradictory. Write a status report: shipped, blocked (why), the exact human
actions needed, and the PR link. Never fabricate a passing gate to keep going.

## Output

Archived changes on `autopilot/build`, updated `docs/roadmap.md` statuses,
committed verification artifacts, an open PR, and a final status report.
