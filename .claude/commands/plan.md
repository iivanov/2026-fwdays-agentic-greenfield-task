---
description: Turn the next requirement slice into an approved OpenSpec change.
argument-hint: "[slice description or requirement id]"
---

# /plan — plan the next change (spec-first)

Produce a small, traceable OpenSpec change for one vertical slice.

Requested slice: **$ARGUMENTS** (if empty, propose the next best slice and
confirm before proposing).

## Steps
1. **Scope one slice.** Read `docs/architecture/1_business/requirements.md` and
   `nfr.md`; pick one independently verifiable slice whose deps are met; list the
   upstream IDs it satisfies (`BR-*`, `NFR-*`, `D-*`, `A-*`, `AT-*`, `Q-*`,
   `T-*`). Foundations before features.
2. **Check for gaps.** If the slice needs product behavior no requirement
   supports, fix the owning upstream doc first, then continue.
3. **Propose.** Invoke the **openspec-propose** skill (`/opsx:propose
   "<slice>"`) to generate `proposal.md`, delta `specs`, `design.md`,
   `tasks.md`. The `openspec/config.yaml` rules enforce ID citations, tests +
   verify + independent-review tasks, and no secrets.
4. **Sanity-check:** proposal cites IDs + non-goals; specs testable incl.
   error/abuse path; design respects the stack + one-way chain and calls out
   security/idempotency/retention/$0; tasks include tests-with-code, a verify
   task, an independent-review task, and a `development_process.md` update. Run
   `openspec validate <name>`.

## Output
Change name + artifacts, upstream IDs, non-goals, and: "Run `/dev-loop` (or
`/opsx:apply`) to implement, then verify + review with separate sub-agents."
