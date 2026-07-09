---
name: decompose-requirements
description: Decompose the product requirements and NFRs into an ordered, dependency-aware backlog of small vertical slices (docs/roadmap.md), each traceable to upstream IDs and sized to one OpenSpec change. Use to create or refresh the autonomous build backlog.
metadata:
  role: planner
  version: "1.0"
---

# Skill: Decompose requirements into a backlog

## Objective

Produce and maintain `docs/roadmap.md`: an ordered backlog of small,
independently verifiable slices that together satisfy every requirement, so the
`/autopilot` loop can build them one at a time. This is the "decompose
requirements into tasks" step.

## Rules of engagement

- Read `docs/architecture/1_business/requirements.md`, `nfr.md`, and the
  downstream data/application/technology docs. Every slice traces to upstream
  IDs (`BR-*`, `NFR-*`, `D-*`, `A-*`, `AT-*`, `Q-*`, `T-*`, `H-*`).
- Slices are small and vertical: each should be one OpenSpec change that can be
  implemented, verified (gates + e2e), and reviewed on its own.
- Order by dependency, foundations first (scaffold → data/RLS → auth → API →
  CRUD → pipeline → lifecycle/ops → deploy). Never schedule a slice before its
  dependencies.
- Do not invent product behavior. If requirements are incomplete for a slice,
  flag it and prefer fixing the upstream doc over guessing.
- Separate genuinely human-only work (accounts, secrets, spend, deploy) into a
  "Human bootstrap required" section — never schedule it as autonomous.

## Instructions

1. Read the requirements/NFRs and current `docs/roadmap.md` (if present) and
   `openspec/changes/` + `changes/archive/` to see what already exists.
2. Build the slice list: for each, capture ID (`R-##`), one-line scope,
   dependencies, upstream IDs, and status (`pending` unless already done).
3. Group into phases; keep the table format already in `docs/roadmap.md`.
4. Populate the "Human bootstrap required" section with account/secret/deploy
   items and the slices that need them.
5. Sanity-check coverage: every `BR-*`/`NFR-*` requirement maps to at least one
   slice. Note any requirement not yet covered.
6. Write/update `docs/roadmap.md`. Do not implement anything here.

## Output

- An updated `docs/roadmap.md` with an ordered, dependency-aware backlog.
- A short coverage note: which requirements are covered by which slices, and any
  gaps to resolve upstream.
- Prompt: "Run `/autopilot` to build the backlog autonomously."
