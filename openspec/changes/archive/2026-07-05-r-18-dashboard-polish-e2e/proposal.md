## Why

R-17 closed operations guardrails, leaving the Phase 4 browser dashboard as the
next visible release-quality gap. The current React shell exposes the core
panels, but it does not consistently follow `docs/DESIGN.md`, does not surface
digest/run/source status as one responsive operating surface, and only has a
login-page Playwright smoke test.

## What Changes

- Refine the authenticated dashboard into a responsive "Sophisticated Newsroom"
  operating surface that works at desktop, tablet, and mobile widths without
  overlapping controls or clipped text.
- Add a dashboard overview for critical user workflows: retained digest history
  with feedback state, flow run status, and source health/warnings.
- Keep slow ingestion, processing, delivery, and cleanup work outside browser
  requests; the dashboard reads durable status and does not trigger long-running
  work.
- Add Playwright coverage that proves the shell, authenticated dashboard, digest
  history/status, and responsive navigation render at desktop and mobile sizes.

## Capabilities

### New Capabilities

- `dashboard-responsive-ux`: Responsive authenticated browser dashboard,
  status overview, and Playwright behavioral evidence for critical flows.

### Modified Capabilities

- `digest-feedback`: Digest history must remain usable inside the polished
  dashboard and responsive layouts.
- `flow-management`: Flow run/status information must be scannable from the
  dashboard without changing flow CRUD semantics.
- `source-management`: Source health and warning states must be visible from the
  dashboard without changing source CRUD semantics.

## Impact

- Affected frontend code: `packages/browser/src/App.tsx`,
  `packages/browser/src/components/*`, `packages/browser/src/index.css`,
  and browser-facing tests.
- Affected behavioral tests: `tests/e2e/*` and possibly focused Vitest tests for
  dashboard data derivation.
- No database schema, Edge Function, provider, or product-scope expansion is
  intended.

Upstream: `NFR-UX-01`, `NFR-PERF-02`, `A-01`, `A-04`, `Q-04`, `T-02`, `T-12`.
