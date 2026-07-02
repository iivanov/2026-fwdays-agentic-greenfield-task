## Context

The project is an AI-Powered Personalized News Aggregator that will consist of a React SPA frontend and a Deno backend (Supabase Edge Functions). Before adding code or configuring hosting/CI, we must establish a monorepo workspace to manage shared configurations, ensure strong TypeScript type checking, enforce code style, and set up the testing framework.

## Goals / Non-Goals

**Goals:**
- Provide a unified `npm` workspace structure supporting multiple packages (e.g., `packages/browser`, `packages/shared`, `packages/edge`).
- Enforce strict typing, zero-warning linting, and consistent formatting across the entire codebase.
- Establish Vitest for both unit and integration tests.

**Non-Goals:**
- CI/CD workflow definitions (reserved for R-03).
- Bootstrapping the local Supabase environment (reserved for R-02).
- Adding actual domain code or React components.

## Decisions

- **Workspace Manager**: `npm workspaces` over `pnpm` or `yarn`. 
  - *Rationale*: Pre-installed with Node, avoids extra dependencies, fulfills zero-cost/simplicity constraints (T-12).
- **Type Checking**: `tsc --noEmit`. 
  - *Rationale*: Verifies TypeScript types without emitting JavaScript, since Vite handles execution (T-13).
- **Linting & Formatting**: `eslint`, `typescript-eslint`, and `prettier`. 
  - *Rationale*: Maintained industry standards for strict zero-warning quality enforcement (T-13).
- **Testing**: `vitest`.
  - *Rationale*: Fast, TS-native, works seamlessly with Vite, and supports backend code tests efficiently (T-12).

## Risks / Trade-offs

- [Risk] Edge Functions run Deno, which requires specific linting/formatting and dependency handling distinct from standard Node/npm setups.
  - *Mitigation*: We will configure the base structure for the monorepo to handle npm packages, but Deno-specific tools (`deno lint`, `deno check`) will be integrated when the actual Edge Function skeleton is built (R-06). We only install the standard Node ecosystem tools for the workspace root and shared/browser modules here.
