## Why

We are beginning the implementation of the AI-Powered Personalized News Aggregator. To support the multi-environment architecture (browser SPA, Edge Functions, shared types) and ensure consistent quality from the start, we need a solid repository foundation. This slice establishes the monorepo structure, strict TypeScript configuration, linting, formatting, and testing baseline before any product code or infrastructure is added.

Satisfies: `BR-PROJ-02..03`, `T-01`, `T-12`, `T-13`, `Q-01`.

## What Changes

- Initialize npm workspaces to support shared configuration, frontend, and backend packages.
- Set up strict TypeScript (`tsc --noEmit` and `deno check` foundation) for the monorepo.
- Configure ESLint + `typescript-eslint` (zero warnings policy).
- Configure Prettier for formatting.
- Set up Vitest for fast, reliable unit and integration testing.
- Add base `.gitignore` and `package.json` scripts for typechecking, linting, formatting, and testing.

Non-goals:
- Setting up CI/CD pipelines (deferred to R-03).
- Initializing the local Supabase environment (deferred to R-02).
- Writing any actual application logic or React components.

## Capabilities

### New Capabilities
- `monorepo-scaffold`: Establishes the core workspace, build, and quality enforcement toolchain.

### Modified Capabilities
None.

## Impact

- **Repository Structure**: Introduces the root `package.json` and basic workspace directories.
- **Developer Experience**: Sets the local development commands (`npm run lint`, `npm run typecheck`, `npm run test`, `npm run format`).
- **Tooling**: Pins the versions for TypeScript, ESLint, Prettier, and Vitest.
