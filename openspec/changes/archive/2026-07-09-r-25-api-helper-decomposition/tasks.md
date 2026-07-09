## 1. OpenSpec Setup

- [x] 1.1 Create proposal, design, and api-skeleton spec delta for API helper decomposition.

## 2. API Refactor

- [x] 2.1 Extract shared API types, HTTP helpers, digest reporting, and flow prompt helpers from `api/helpers.ts`.
- [x] 2.2 Extract delivery-channel config validation and verification helpers.
- [x] 2.3 Move route lifecycle and route handling into a focused router module.
- [x] 2.4 Reduce `api/helpers.ts` to compatibility exports.

## 3. Verification and Review

- [x] 3.1 Run focused API helper Vitest coverage and Deno API gates.
- [x] 3.2 Run broader regression gates: unit tests, coverage, Deno lock, OpenSpec validation, and scoped whitespace checks.
- [x] 3.3 Run independent verifier and reviewer passes on the final diff.

## 4. Documentation and Commit

- [x] 4.1 Update `docs/state.md` and `docs/development_process.md` with the refactor and verification evidence.
- [x] 4.2 Commit the completed stage without staging unrelated user changes.
