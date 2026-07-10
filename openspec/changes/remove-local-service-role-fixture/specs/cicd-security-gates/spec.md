## ADDED Requirements

### Requirement: Runtime Local Integration Credentials
Supabase integration tests SHALL obtain the API URL and `service_role`
credential from the currently running local Supabase CLI stack at test runtime,
without requiring a developer-provided credential or committing a privileged
credential fixture (satisfies `NFR-SEC-03`, `T-12`, `Q-01`, `Q-04`, and
`NFR-OPS-04`).

#### Scenario: Started local stack
- **WHEN** `npm run test:integration` is executed after the local Supabase
  stack has started and been reset
- **THEN** the test launcher discovers the local API URL and service-role key,
  passes them only to Vitest, and integration assertions execute without manual
  environment setup

#### Scenario: Missing local stack or credentials
- **WHEN** the local Supabase stack is unavailable or its status output lacks a
  required integration credential
- **THEN** the integration command exits non-zero with start/reset guidance and
  does not print credential values

### Requirement: No Tracked Privileged Test Credential
Tracked repository files SHALL not contain a local Supabase `service_role` JWT
or a scanner allowlist for such a credential (satisfies `NFR-SEC-03`, `T-12`,
and `Q-01`).

#### Scenario: Secret scan after fixture removal
- **WHEN** `npm run secrets:scan` is executed from the repository root
- **THEN** it passes without an allowlist for a Supabase local service-role
  credential
