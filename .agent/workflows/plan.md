---
description: Turn the next requirement slice into an approved OpenSpec change (proposal + specs + design + tasks).
---

# /plan — plan the next change (spec-first)

Produce a small, traceable OpenSpec change for one vertical slice. This is the
front of the loop; implementation happens later via the maker.

**Input (optional):** a slice description or requirement id. If empty, propose
the next best slice and confirm with the user before proposing.

## Steps

1. **Scope one slice.** Read `docs/architecture/1_business/requirements.md` and
   `nfr.md`. Pick one independently verifiable slice whose dependencies are met.
   Identify the upstream IDs it satisfies (`BR-*`, `NFR-*`, `D-*`, `A-*`,
   `AT-*`, `Q-*`, `T-*`). Foundations before features.
2. **Check for gaps.** If the slice needs product behavior that no requirement
   supports, stop: fix the owning upstream doc (usually `1_business`) first,
   then continue. Do not invent behavior in the proposal.
3. **Propose.** Run `/opsx:propose "<slice>"` to generate `proposal.md`, delta
   `specs`, `design.md`, and `tasks.md`. The `openspec/config.yaml` rules will
   push it to cite IDs, add test + verify + independent-review tasks, and avoid
   secrets.
4. **Sanity-check the plan.**
   - Proposal cites upstream IDs and lists non-goals.
   - Specs are testable and cover the error/abuse path.
   - Design respects the selected stack and the one-way decision chain and calls
     out security / idempotency / retention / $0 impact.
   - Tasks include tests-with-code, a verify task, an independent-review task,
     and a `development_process.md` update task.
   - Run `openspec validate <name>`.

## Output

- The change name and its artifacts.
- The upstream IDs it satisfies and its non-goals.
- Next step: "Run `/dev-loop` (or `/opsx:apply`) to implement, then verify and
  review with separate sub-agents."
