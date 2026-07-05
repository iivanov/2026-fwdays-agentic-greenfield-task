## MODIFIED Requirements

### Requirement: Continuous Integration Pipeline
The repository SHALL use GitHub Actions and matching root-level local scripts to verify workspace status on push/PR events, including Node typecheck/lint/format/test, Deno Edge Function check/lint/format, backend coverage, browser build, Playwright smoke behavior, dependency update check, actionlint, deployment configuration audit, and local Supabase migration linting where the local stack is available (satisfies T-12, T-13, T-14, Q-01, Q-02, Q-03, Q-04, Q-05, NFR-OPS-04).

#### Scenario: Running verification gates in CI
- **WHEN** a pull request is submitted targeting `main`
- **THEN** GitHub Actions runs the committed root scripts for typechecking, linting, formatting, unit tests, backend coverage, browser build, Deno check, Deno lint, Deno format check, Deno dependency update check, Playwright smoke tests, deployment configuration audit, actionlint, npm audit, and Supabase migration linting

#### Scenario: Verifier runs local gates
- **WHEN** a checker verifies a material code or infrastructure change locally
- **THEN** the checker can run the same documented root scripts used by CI and record exact pass/fail evidence without relying on uncommitted shell knowledge
