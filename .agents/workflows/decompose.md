---
description: Decompose requirements into an ordered, dependency-aware build backlog (docs/roadmap.md).
---

# /decompose — build the backlog

Turn the requirements into the ordered slice backlog the autopilot consumes.

## Steps

1. Run the **decompose-requirements** skill.
2. It reads `docs/architecture/1_business/requirements.md`, `nfr.md`, and the
   downstream docs, plus existing `openspec/changes/` (+ archive) and any current
   `docs/roadmap.md`.
3. It writes/refreshes `docs/roadmap.md`: ordered `R-##` slices with scope,
   dependencies, upstream IDs, and status; a "Human bootstrap required" section
   for account/secret/spend/deploy items; and a coverage note mapping every
   `BR-*`/`NFR-*` to a slice.
4. Do not implement anything — this only plans.

## Output

- Updated `docs/roadmap.md` and a coverage note (gaps to resolve upstream).
- Next: "Run `/autopilot` to build the backlog autonomously, or `/dev-loop` for
  one supervised slice."
