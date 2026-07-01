---
description: Run the spec-driven, maker≠checker development loop to move the project toward done, one verified change at a time.
---

# /dev-loop — the development loop

Drive the project to completion in small, spec-driven, independently-verified
increments. **Maker ≠ checker:** the agent that implements never certifies its
own work — verify and review run as **separate sub-agents**. Read
`AGENTS.md` and `.agent/rules/` first; they are binding.

**Input (optional):** a focus area or requirement id (e.g. `BR-USER-01`). With
no input, pick the next highest-value slice yourself.

Repeat the cycle below until the requested scope (or the whole product) is done.
Do **one change per cycle**. Pause for the user when a decision changes product
scope or operational guarantees.

## 1. Pick the next change

- Check work in flight: `openspec list` (active changes) and `openspec status`.
- If a change is already mid-implementation, continue it. Otherwise choose the
  next small vertical slice: the earliest unmet requirement in
  `docs/architecture/1_business/requirements.md` whose dependencies are met,
  biased toward foundations first (workspace scaffold → auth → data/RLS →
  ingestion → processing → delivery → cleanup/observability).
- Announce the pick and the upstream IDs it satisfies.

## 2. Plan (spec-first)

- Run `/plan` (or `/opsx:propose "<slice>"`) to generate `proposal.md`, delta
  `specs`, `design.md`, `tasks.md` under `openspec/changes/<name>/`.
- Ensure the proposal cites upstream IDs and lists non-goals. Run
  `openspec validate <name>`. If the slice reveals a product gap, fix the
  upstream doc first, then re-plan.

## 3. Implement (MAKER)

- Use the **implement-change** skill (drives `/opsx:apply`). Implement the tasks
  with tests written alongside the code. Keep `tasks.md` checkboxes current.
- If a new gate/tool is needed, scaffold it in this change and add it to the
  `AGENTS.md` Verification section.
- Produce a maker handoff summary, then **stop** — do not self-verify or
  self-approve.

## 4. Verify (SUB-AGENT #1 — separate from maker)

- **Spawn a new sub-agent in a fresh context** and have it run the
  **verify-change** skill on the change diff. Pass it the acceptance criteria
  and the diff only — not the maker's self-assessment.
- It returns a gate table + PASS/FAIL verdict with evidence.
- If **FAIL** → hand findings back to the maker (step 3), fix, and re-verify on
  the new diff. Do not proceed on a stale pass.

## 5. Review (SUB-AGENT #2 — separate from maker and verifier)

- **Spawn another separate sub-agent** and have it run the **review-change**
  skill: independent code review against requirements, security, correctness,
  data lifecycle, cost constraints, and tests.
- It returns APPROVE / REQUEST CHANGES with ranked findings.
- If **REQUEST CHANGES** with blocking findings → back to the maker (step 3);
  then re-run **both** verify and review on the final diff.

## 6. Archive & record

Only when verify is green AND review has no unresolved blocking findings:

- Run `openspec validate <name> --strict`, then `/opsx:archive` to fold delta
  specs into the main specs and move the change to `openspec/changes/archive/`.
- Update `docs/development_process.md` with the milestone: human decisions,
  agent contribution, evidence/gates run, files changed, findings, unresolved
  work. Distinguish done from planned.
- Commit on a feature branch (never `main`) with a message referencing the
  requirement IDs; open a PR (CodeRabbit reviews it as an extra layer).

## 7. Loop

- Report a one-line status: change archived, IDs satisfied, gates green,
  what's next.
- Return to step 1 for the next slice until scope is complete. Stop and ask the
  user when blocked on a real product/operational decision.

## Guardrails

- Never skip the two separate sub-agents. Never let the maker approve itself.
- Never claim a gate that was not run; never commit secrets or `.env` values.
- Never expand beyond the approved change; one change per cycle.
