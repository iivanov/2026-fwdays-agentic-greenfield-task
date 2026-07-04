## Design

R-11I is a governance and documentation guardrail. Canonical specs are the
current source of truth, so their `Purpose` sections should explain scope and
traceability instead of carrying generated placeholders.

Archive hygiene is enforced prospectively. A small Vitest test scans the
repository-local OpenSpec tree:

- every canonical `openspec/specs/*/spec.md` must have a non-placeholder purpose
  before `## Requirements` and must retain upstream ID traceability somewhere in
  the spec;
- every archive outside the explicitly documented pre-audit legacy allowlist
  must have `tasks.md`, `verification.md`, and `review.md`;
- every non-legacy archived task checklist must be complete.

## Historical Evidence

The test intentionally does not mutate legacy archives from R-01..R-11. Those
archives are already documented as implementation evidence, not checker proof,
in `docs/state.md` and the verification evidence governance spec. Future
archives cannot repeat that pattern because the hygiene test will fail.

## Security and Operations

No secrets, provider state, or runtime configuration are introduced. The change
improves `NFR-OPS-04` by making evidence gaps executable failures in the normal
unit-test gate.
