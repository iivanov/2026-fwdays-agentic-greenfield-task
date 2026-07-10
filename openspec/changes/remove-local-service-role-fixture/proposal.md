## Why

The repository currently contains Supabase's documented local `service_role`
JWT as an integration-test fallback. Although the credential only works against
the default local emulator, committing a privileged-looking JWT creates a
GitGuardian incident and violates the repository's secret-hygiene policy.

## What Changes

- Discover the running local Supabase API URL and service-role key immediately
  before integration tests, without logging either value.
- Remove the committed local service-role JWT fallback and its Gitleaks
  allowlist.
- Scope the local service-role key to the integration-test process rather than
  exporting it for all later CI steps.
- Document the GitGuardian incident as a local test credential false positive;
  no production credential rotation is required.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `cicd-security-gates`: Integration tests obtain local privileged credentials
  at runtime and tracked-file secret scanning needs no exception for them.

## Impact

Affected areas are the root integration-test script, local Supabase test setup,
GitHub Actions CI, Gitleaks configuration, and security-process records. This
change satisfies `NFR-SEC-03`, `T-12`, `Q-01`, `Q-04`, and `NFR-OPS-04`.
