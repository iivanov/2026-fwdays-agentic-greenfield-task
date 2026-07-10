## ADDED Requirements

### Requirement: Hosted Cron Runtime Bootstrap Evidence
The repository SHALL implement and document a hosted Supabase Cron runtime
configuration that resolves the project URL and scheduler secret from named
Supabase Vault entries, without committing a project URL, scheduler secret,
service-role key, or other provider state (satisfies `NFR-SEC-03`,
`NFR-OPS-04`, `T-05`, `T-06`, `T-14`, `H-02`, and `H-06`). The procedure MUST
provision the Vault entries, explain why an authorized manual function call is
not proof of cron health, and provide read-only checks for Vault-entry presence,
scheduled jobs, cron run history, and `pg_net` HTTP outcomes.

#### Scenario: New hosted project is bootstrapped
- **WHEN** an operator deploys the database migrations and Edge Functions to a
  new hosted Supabase project
- **THEN** the deployment guide identifies the project URL and scheduler secret
  as named human-entered Vault entries rather than migration values
- **AND** it gives commands that do not print or commit either value
- **AND** it requires verification of the scheduled HTTP path before enabling
  automatic reports

#### Scenario: Cron job executes after Vault bootstrap
- **WHEN** the named Vault entries exist and a scheduled cron job runs
- **THEN** the job resolves the hosted URL and scheduler authorization from
  Vault
- **AND** its stored `cron.job` command contains neither value

#### Scenario: Cron cannot resolve the local fallback hostname
- **WHEN** `net._http_response` records `Couldn't resolve host name` for a
  scheduled request
- **THEN** the deployment guide identifies an absent/incorrect hosted Vault URL
  entry or an outdated cron migration as the likely cause
- **AND** it directs the operator to check the active cron command and apply
  current migrations instead of editing `cron.job` directly
