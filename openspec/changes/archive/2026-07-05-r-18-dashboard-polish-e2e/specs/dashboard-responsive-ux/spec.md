## ADDED Requirements

### Requirement: Authenticated dashboard SHALL provide a responsive operational overview

The browser dashboard SHALL present digest history, flow run status, and source
health warnings in a responsive layout that follows the approved newsroom design
system and remains usable at desktop, tablet, and mobile widths.

Upstream: `NFR-UX-01`, `NFR-PERF-02`, `A-01`, `A-04`, `Q-04`, `T-02`, `T-12`

#### Scenario: Desktop operator view shows critical status

- **WHEN** an authenticated user opens the dashboard on a desktop viewport
- **THEN** the first authenticated view includes digest history, flow run
  status, and source health/warning summaries
- **AND** the existing domain panels remain reachable through clear navigation
- **AND** the visual treatment follows the light editorial newsroom system in
  `docs/DESIGN.md`

#### Scenario: Mobile dashboard remains usable without horizontal overflow

- **WHEN** an authenticated user opens the dashboard on a mobile viewport
- **THEN** navigation, overview summaries, forms, digest feedback controls, and
  status chips remain visible and reachable without horizontal page overflow
- **AND** text wraps or truncates intentionally instead of overlapping controls

### Requirement: Browser dashboard SHALL not execute slow pipeline work inline

The polished dashboard SHALL read existing durable state for digest history,
flow status, and source warnings. It SHALL NOT add browser requests that perform
ingestion, AI processing, delivery, retry, or cleanup work inline.

Upstream: `NFR-PERF-02`, `A-04`, `Q-04`

#### Scenario: Dashboard overview reads status only

- **WHEN** the dashboard renders the operational overview
- **THEN** it uses existing user-owned reads/API calls for durable status
- **AND** it does not expose a long-running "run now" or worker-execution
  command in this slice

### Requirement: Critical dashboard flows SHALL have Playwright evidence

Responsive browser tests SHALL exercise the login shell and authenticated
dashboard flows for the digest history, flow status, source warning, and
navigation scenarios.

Upstream: `Q-04`, `T-12`, `NFR-UX-01`

#### Scenario: Playwright verifies responsive critical flows

- **WHEN** the browser test suite runs in CI or locally
- **THEN** it verifies the login shell and authenticated dashboard at desktop
  and mobile viewport sizes
- **AND** it captures the digest history, flow status, source warning, and
  feedback-control paths using deterministic test data
