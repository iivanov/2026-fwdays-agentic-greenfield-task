# cicd-security-gates Specification

## Purpose
Define the repository verification gates, CI behavior, dependency checks, and
secret-hygiene expectations that support reliable local and hosted validation
(`T-12`, `T-13`, `Q-01..Q-05`, `NFR-OPS-04`).
## Requirements
### Requirement: Continuous Integration Pipeline
The repository SHALL use GitHub Actions and matching root-level local scripts to verify workspace status on push/PR events, including Node typecheck/lint/format/test, Deno Edge Function check/lint/format, backend coverage, browser build, Playwright smoke behavior, dependency update check, actionlint, deployment configuration audit, and local Supabase migration linting where the local stack is available (satisfies T-12, T-13, T-14, Q-01, Q-02, Q-03, Q-04, Q-05, NFR-OPS-04).

#### Scenario: Running verification gates in CI
- **WHEN** a pull request is submitted targeting `main`
- **THEN** GitHub Actions runs the committed root scripts for typechecking, linting, formatting, unit tests, backend coverage, browser build, Deno check, Deno lint, Deno format check, Deno dependency update check, Playwright smoke tests, deployment configuration audit, actionlint, npm audit, and Supabase migration linting

#### Scenario: Verifier runs local gates
- **WHEN** a checker verifies a material code or infrastructure change locally
- **THEN** the checker can run the same documented root scripts used by CI and record exact pass/fail evidence without relying on uncommitted shell knowledge

### Requirement: Dependency Audits
The repository SHALL check package updates daily and SHALL provide lockfile-backed npm audit gates for Node dependencies and lockfile-backed Deno dependency update checks (satisfies Q-05, T-13).

#### Scenario: Dependabot check
- **WHEN** GitHub parses the `.github/dependabot.yml` config
- **THEN** scheduled checks for updates are enabled for npm dependencies and GitHub Actions dependencies

#### Scenario: Deno dependency integrity
- **WHEN** Deno Edge Function dependencies are checked in CI or by a verifier
- **THEN** dependency resolution uses the committed Deno lockfile in frozen mode and Deno outdated checks report incompatible or unavailable dependency update metadata before the change can pass

### Requirement: Security Analysis & Secret Hygiene
The repository SHALL provide a public environment template for developers, run automated scanners, and keep verification artifacts free of secrets.

#### Scenario: Safe environment templates
- **WHEN** a developer clones the repository
- **THEN** a `.env.example` file is present containing only keys and zero real secrets

#### Scenario: Verification reports do not expose secrets
- **WHEN** verifier and reviewer reports are committed for a change
- **THEN** they contain commands, results, and non-sensitive evidence only, with any required secret/account actions recorded as human-bootstrap blockers

### Requirement: Deno Edge Function Verification
The repository SHALL verify Supabase Edge Function source with Deno type checking, linting, formatting, lockfile integrity, and dependency update checking before runtime worker changes are accepted (satisfies T-03, T-12, T-13, Q-01, Q-02, Q-05).

#### Scenario: Edge function static gate
- **WHEN** `npm run deno:check`, `npm run deno:lint`, and `npm run deno:fmt` are executed from the repository root
- **THEN** every committed Supabase Edge Function entry point and shared module is checked with the committed Deno configuration without modifying source files

#### Scenario: Edge function dependency gate
- **WHEN** `npm run deno:lock` and `npm run deno:outdated` are executed from the repository root or CI
- **THEN** Deno dependency resolution succeeds with the committed lockfile and the update-check gate reports incompatible dependency update status as failures

### Requirement: Browser Behavioral Harness
The repository SHALL include a Playwright harness that can build and serve the browser app and verify at least one deterministic critical smoke path (satisfies T-12, Q-04).

#### Scenario: Browser smoke test
- **WHEN** `npm run test:e2e` is executed from the repository root
- **THEN** Playwright starts the committed browser build, loads the app in Chromium, and asserts deterministic visible application shell content

### Requirement: Backend Coverage Gate
The repository SHALL provide a backend-focused coverage gate that fails when covered backend/API helper code falls below the committed threshold (satisfies T-12, Q-01, Q-03).

#### Scenario: Coverage threshold failure
- **WHEN** `npm run test:coverage` is executed from the repository root
- **THEN** Vitest reports coverage for the configured backend/API helper scope and exits non-zero if the committed thresholds are not met

### Requirement: Visible Integration Prerequisites
Local Supabase integration tests SHALL fail visibly when the required local Supabase stack is unavailable instead of silently skipping assertions (satisfies T-12, Q-01, Q-04, NFR-OPS-04).

#### Scenario: Missing local Supabase stack
- **WHEN** `npm run test:integration` is executed while the local Supabase stack is not running or unhealthy
- **THEN** the command exits non-zero and prints the prerequisite command(s) required to run the integration gate

#### Scenario: Available local Supabase stack
- **WHEN** `npm run test:integration` is executed while the local Supabase stack is running and migrations are applied
- **THEN** the integration tests execute their assertions instead of returning early
