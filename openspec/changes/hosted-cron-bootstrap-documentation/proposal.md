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

- Document the project-specific Supabase Cron runtime inputs separately from
  versioned migrations and Edge Function secrets.
- Add a copyable hosted-cron bootstrap procedure that configures the public
  project URL and scheduler authorization without placing values in Git.
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

- Updates `docs/deployment_setup_guide.md`, the hosting deployment record, and
  the development-process/state records.
- Adds a delta specification and verification/review evidence for the
  documentation-only change.
- Does not change migrations, cron schedules, runtime code, provider accounts,
  or hosted configuration.
