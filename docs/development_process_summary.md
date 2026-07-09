# Development Process Summary

## Steps
1. Defined architecture as a collaboration between human and AI agents (./docs/architecture/).
2. Human defined requirements and asked AI to generate all other levels of the architecture moving from high-level to low-level Business -> Data -> Application -> Technology (using trade-off analysis).
3. Human verified ideas in each level and asked to add more detail where needed.
4. Based on the requirements AI prepared required list of skills, AGENTS.md, validation gates, and other artifacts.
5. Using AI was prepared a general implementation plan. Finally AI implemented the plan step by step using OpenSpec.
6. Human configured infrastructure and deployed the application based on the AI generated documentation.

## Thoughts after the development process

To avoid major refactoring later, it’s better to have stronger human involvement at the beginning of the project, until the required skills, gates, and feedback loops are defined and polished. At later stages, human involvement can be significantly reduced.

For example, I missed that the AI had put all the logic into a single file, which required refactoring later. This would have been much cheaper to catch and fix earlier.

## General AI Summary

The human owns
intent, constraints, and acceptance, while the AI converts those decisions into
traceable architecture, implementation, tests, and process records.

The core rule is one-way decision flow: business requirements and non-functional
requirements drive data, application architecture, quality tactics, technology
choices, and hosting. Downstream documents must not invent product behavior; any
changed decision is updated at its owning upstream layer first and then
propagated through the dependent artifacts.

Implementation proceeds one change at a time through OpenSpec:

1. capture intent and ownership;
2. analyze downstream impact;
3. verify unstable external facts with official sources;
4. implement the smallest coherent change;
5. run the applicable mechanical and behavioral checks;
6. require separate verifier and reviewer passes before archive.

The maker, verifier, and reviewer roles are intentionally separate. A maker's
self-check is useful evidence, but it does not certify a material change.
Production readiness is claimed only when the required gates, retained checker
artifacts, and unresolved risks support that claim.

Autonomous development is allowed for locally verifiable work, but external
accounts, secrets, spending, deployment, and other human-bootstrap steps remain
explicitly human-gated. Progress is recorded in the roadmap, OpenSpec changes,
git history, and the development process log so the project can resume without
rewriting history or overstating evidence.
