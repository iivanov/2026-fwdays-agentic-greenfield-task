---
trigger: always_on
description: Spec-driven development with OpenSpec and one-way requirement traceability.
---

# Rule: Spec-driven, traceable changes

No production code, migration, or infra change lands without an approved
OpenSpec change behind it. Specs come before code.

## Always

- Start every unit of work as an OpenSpec change: `/plan` → `/opsx:propose`
  produces `proposal.md`, delta `specs`, `design.md`, and `tasks.md` under
  `openspec/changes/<name>/`. Implement only what an approved change describes.
- Trace every change to at least one stable upstream ID: `BR-*`, `NFR-*`,
  `D-*`, `A-*`, `AT-*`, `Q-*`, `T-*`, `H-*`. Put the IDs in the proposal.
- Respect the one-way decision chain (see `docs/README.md`):
  `1_business → 2_data → 3_application → 4_technology → hosting`.
  A downstream layer may implement an upstream decision but must never
  silently change it.
- If implementation reveals a product gap or ambiguity, stop and fix the
  owning **upstream** document first (usually `docs/architecture/1_business/`),
  then propagate downstream. Do not invent product behavior in code.
- Keep changes small: one independently verifiable vertical slice per change,
  with explicit non-goals.

## Never

- Never write code "to be spec'd later." Never broaden scope beyond the
  approved change. Never introduce a technology not selected in
  `4_technology/technology_requirements.md` without a new proposal.

## Lifecycle

`propose → apply (maker) → verify (sub-agent) → review (sub-agent) →
archive`. Keep `tasks.md` checkboxes current as the source of progress.
Run `openspec validate --all` before archiving. See `/dev-loop`.
