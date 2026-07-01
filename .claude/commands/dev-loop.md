---
description: Run the spec-driven, maker≠checker development loop (one verified change per cycle).
argument-hint: "[focus area or requirement id, e.g. BR-USER-01]"
---

# /dev-loop — the development loop (Claude Code)

Drive the project to completion in small, spec-driven, independently-verified
increments. **Maker ≠ checker:** the context that implements never certifies its
own work — verify and review run as **separate sub-agents launched with the
Agent tool**. Read `AGENTS.md` and `.agent/rules/*` first; they are binding.

Focus for this run: **$ARGUMENTS** (if empty, pick the next best slice).

Do **one change per cycle**; repeat until scope is done. Pause for the user when
a decision changes product scope or operational guarantees.

## 1. Pick the next change
- `openspec list` / `openspec status` for work in flight; continue it if any.
- Else pick the next small vertical slice from
  `docs/architecture/1_business/requirements.md` whose deps are met
  (foundations first: workspace → auth → data/RLS → ingestion → processing →
  delivery → cleanup/observability). Announce the pick + upstream IDs.

## 2. Plan (spec-first)
- Run `/plan` or invoke the **openspec-propose** skill (`/opsx:propose`) to
  create `proposal.md`, delta `specs`, `design.md`, `tasks.md`.
- `openspec validate <name>`. Fix upstream docs first if a product gap appears.

## 3. Implement (MAKER)
- Use the **implement-change** skill. Implement tasks with tests alongside code;
  keep `tasks.md` current; scaffold any new gate and add it to the `AGENTS.md`
  Verification section. Produce a maker handoff summary, then **stop** — do not
  self-verify or self-approve.

## 4. Verify (SUB-AGENT #1 — separate from maker)
- Launch a **separate sub-agent with the Agent tool** (`general-purpose`) to run
  the **verify-change** skill (or the built-in `/verify`) on the diff. Pass it
  the acceptance criteria + `git diff` only.
- It returns a gate table + PASS/FAIL. On FAIL → back to step 3, then re-verify
  the new diff.

## 5. Review (SUB-AGENT #2 — separate from maker and verifier)
- Launch **another separate sub-agent with the Agent tool** to run the
  **review-change** skill (or the built-in `/code-review`).
- It returns APPROVE / REQUEST CHANGES with ranked findings. On blocking
  findings → back to step 3, then re-run **both** verify and review.

## 6. Archive & record
Only when verify is green AND review has no unresolved blocking findings:
- `openspec validate <name> --strict`, then `/opsx:archive`.
- Update `docs/development_process.md` (human decisions, agent contribution,
  gates run, files changed, findings, unresolved work; done vs. planned).
- Commit on a feature branch (never `main`) referencing the requirement IDs;
  open a PR (CodeRabbit is the extra external review layer).

## 7. Loop
Report one-line status (archived / IDs / gates green / next) and return to
step 1. Stop and ask when blocked on a real product/operational decision.

## Guardrails
- Never skip the two separate sub-agents; never let the maker approve itself.
- Never claim a gate that was not run; never commit secrets or `.env` values.
- One change per cycle; stay inside the approved scope.
