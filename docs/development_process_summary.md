# Development Process Summary

Initially was defined architecture as a collaboration between human and AI agents (./docs/architecture/). Human defined requirements and asked AI to generate all other levels of the architecture. Then human verified ideas and asked to add more detail where needed.

This project is developed through a spec-driven human-AI loop. The human owns
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
