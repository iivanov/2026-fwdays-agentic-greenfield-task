---
trigger: always_on
description: How to operate unattended in autopilot — decide from the docs, keep checking, escalate only real blockers.
---

# Rule: Autonomous operation (autopilot)

When running the autonomous loop (`/autopilot`), the goal is to move the roadmap
to done **without waiting for a human**, while never lowering the bars in the
other rules (spec-driven, maker≠checker, verification-gates, security-and-secrets).

## Decide, don't wait

- Resolve ambiguity from the authoritative docs (`docs/architecture/`,
  `openspec/config.yaml`, `docs/roadmap.md`) and the selected stack. Pick the
  smallest reasonable option and record the decision in the change's
  `design.md` / `docs/development_process.md`.
- Do **not** call interactive prompts (no AskUserQuestion) mid-loop. Prefer a
  sensible default over a stall.
- If a genuine **product** gap exists (behavior no requirement supports), do not
  invent it: fix the owning upstream doc with a conservative interpretation,
  note it as a decision for later human confirmation, and continue.

## Keep maker ≠ checker

Even unattended: implement with one sub-agent, verify with a separate sub-agent,
review with a third. Autonomy changes *who decides*, never *whether it is
checked*. The verification gate is hard — a slice is not `done` until all
applicable static and behavioral gates pass, a durable `verification.md` records
the evidence, and the reviewer sub-agent has no unresolved blocking findings.
UI/API/runtime behavior requires a green Playwright e2e pass. Documentation-only
changes use the documentation gates in `30-verification-gates` and record
Playwright as not applicable rather than fabricating a browser run.

## Safety rails (never cross without an explicit human go-ahead)

- Never commit secrets, `.env` values, tokens, or provider state.
- Work directly on the `main` branch; **never push to origin**, never force-push, never auto-merge PRs.
- Never deploy to any hosted environment and never take any action that spends
  money or creates external accounts. Collect those under "Human bootstrap
  required" in `docs/roadmap.md` instead.
- Never disable the security gates, sandbox, RLS, or SSRF/encryption checks to
  make something pass. Fix the code, not the guard.
- Never delete or rewrite user data, requirements, or history to "resolve" a
  failure.

## Stop / escalate conditions

Pause and hand back to the human only when:

- every remaining roadmap slice is `blocked`;
- progress requires a human-bootstrap item (account, secret, spend, deploy);
- the same slice fails verification after 3 full fix→verify attempts;
- an upstream requirement is genuinely contradictory and cannot be safely
  interpreted.

On stop, write a concise status report: what shipped, what is blocked and why,
and the exact human actions needed to unblock.

## Progress hygiene

- One slice per cycle; keep `docs/roadmap.md` statuses and `tasks.md` current.
- Commit each archived change on the `main` branch with a message citing requirement
  IDs.
- After each slice, immediately continue to the next `pending` one.
