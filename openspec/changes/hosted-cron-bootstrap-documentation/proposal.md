## Why

Hosted Supabase Cron executions are currently able to fall back to the
local-only `http://kong:8000` endpoint when the project-specific cron URL is
not bootstrapped. Manual `curl` calls can still succeed because they use the
hosted URL directly, leaving an operator with working manual reports but no
automatic processing.

The deployment guide needs an explicit, secret-safe hosted-cron bootstrap and
verification procedure so the scheduling contract in `A-04`, `T-05`, `T-06`,
`T-14`, and `H-02/H-06` is operable after a new deployment without committing
provider state or credentials (`NFR-SEC-03`, `NFR-OPS-04`).

## What Changes

- Replace the unsupported database-setting scheduler configuration with a
  Vault-backed cron migration that keeps values out of `cron.job` and Git.
- Document the project-specific Vault bootstrap procedure for the public
  project URL and scheduler authorization.
- Add read-only SQL checks for cron registration, recent cron results, and
  `pg_net` HTTP outcomes, including the DNS-failure diagnosis observed in the
  hosted environment.
- Make the final deployment order and troubleshooting table require cron
  verification before the service is considered operational.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `deployment-bootstrap`: Hosted backend bootstrap documentation must make
  project-specific Cron configuration and verification explicit while keeping
  provider values outside version control.

## Impact

- Updates the hosted cron migration, migration-source tests,
  `docs/deployment_setup_guide.md`, the hosting deployment record, and the
  development-process/state records.
- Adds a delta specification and verification/review evidence for the
  Vault-backed scheduler repair.
- Does not create or change a hosted Vault secret, provider account, or other
  hosted configuration; the operator supplies those values after deployment.
