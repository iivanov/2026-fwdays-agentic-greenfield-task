## 1. Monorepo Setup

- [x] 1.1 Create `package.json` at project root with `workspaces` defined for `packages/*` and `apps/*`.
- [x] 1.2 Create `packages/shared`, `packages/browser`, `packages/edge` directories and their base `package.json` files.


## 2. Configuration & Tooling

- [x] 2.1 Install and configure `typescript` at the root, adding `tsconfig.json` bases.
- [x] 2.2 Install and configure `prettier`, adding `.prettierrc` and `.prettierignore`.
- [x] 2.3 Install and configure `eslint` and `typescript-eslint` plugins, adding an `eslint.config.js` root configuration.
- [x] 2.4 Add `npm run typecheck`, `npm run format`, and `npm run lint` scripts to the root `package.json`.

## 3. Testing Framework

- [x] 3.1 Install `vitest` at the root and add basic `vitest.config.ts`.
- [x] 3.2 Add a placeholder unit test in `packages/shared` to verify the test runner works.
- [x] 3.3 Add `npm run test` script to the root `package.json`.

## 4. Documentation & Verification

- [x] 4.1 Update the `AGENTS.md` Verification section to list the newly runnable gates (`npm run typecheck`, `npm run lint`, `npm run format`, `npm run test`).
- [x] 4.2 Update `docs/development_process.md` to record the monorepo tooling decisions.
- [x] 4.3 Run `npm run typecheck`, `npm run format`, `npm run lint`, and `npm run test` locally and verify they pass.

## 5. Review & Archive

- [x] 5.1 Spawn the `verify-change` sub-agent to execute the actual gates and report the outcome.
- [x] 5.2 Spawn the `review-change` sub-agent to review the PR diff against security and project rules.
- [x] 5.3 Once both checkers pass, archive the change.
