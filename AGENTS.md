# Repository Agent Guidance

## Scope

This file applies to the entire repository. Add a nested `AGENTS.md` only when a subtree needs additional rules; closer guidance may refine this file for that subtree.

## Sources of Truth

- Follow the documentation decision strategy in `docs/README.md`.
- Preserve the dependency direction: business requirements and NFRs → data → application architecture/tactics/quality → technology trade-offs → hosting.
- Update the owning upstream layer first when a decision changes, then propagate it through downstream traceability.
- Do not introduce product behavior in data, application, technology, or hosting documents without a supporting business requirement.

## Working Agreement

- Inspect `git status` before editing and preserve unrelated user changes.
- Use official, current sources for provider limits, pricing, security behavior, and product capabilities; record verification dates in technology documents.
- Keep technology names out of business, data, and application architecture documents unless the name is itself an approved product constraint.
- Never commit secrets, production data, `.env` values, provider state, database dumps, or generated private configuration.
- Prefer maintained open-source tools and no-cost public-repository GitHub capabilities where they satisfy the requirements.

## Development Process Record

- Update `docs/development_process.md` after every material feature, architecture decision, tooling change, verification loop, or human correction.
- Record what actually happened: human decisions, agent contribution, evidence checked, files changed, verification run, findings, and unresolved work.
- Distinguish completed work from planned work. Do not describe proposed CI, tests, infrastructure, deployments, or independent reviews as already implemented.
- Keep the record concise and append/update milestones instead of inventing a polished history after the fact.

## Verification

- For documentation changes, run `git diff --check`, validate local links/paths, and check requirement/decision traceability and stale terminology.
- For code or infrastructure changes, run the narrowest relevant formatter, lint, type, test, security, migration, and IaC validation commands defined by the repository. Report exactly which checks ran.
- The application has not been scaffolded yet; do not invent executable project commands. Add verified commands here when the toolchain exists.
- Use a separate checker pass for material changes when available. A maker's self-review is useful but is not evidence of independent review.

## Change Handoff

- Summarize the outcome first.
- Link changed files and identify remaining risks or decisions.
- Never claim production readiness from documentation review alone.
