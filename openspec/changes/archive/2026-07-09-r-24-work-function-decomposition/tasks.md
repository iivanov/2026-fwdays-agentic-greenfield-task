## 1. OpenSpec Setup

- [x] 1.1 Create proposal, design, and scheduler-queue spec delta for worker decomposition.

## 2. Worker Refactor

- [x] 2.1 Extract shared worker types, errors, database helpers, logging, and alerting from `work/index.ts`.
- [x] 2.2 Extract ingestion, processing, and delivery domain logic into focused modules.
- [x] 2.3 Reduce `work/index.ts` to the Edge Function entrypoint plus stable compatibility exports.

## 3. Verification and Review

- [x] 3.1 Run focused worker Vitest suites and Deno worker gates.
- [x] 3.2 Run broader regression gates: unit tests, coverage, Deno lock, OpenSpec validation, and diff whitespace check.
- [x] 3.3 Run independent verifier and reviewer passes on the final diff.

## 4. Documentation and Commit

- [x] 4.1 Update `docs/state.md` and `docs/development_process.md` with the refactor and verification evidence.
- [x] 4.2 Commit the completed stage without staging unrelated user changes.
