## Why

GitGuardian scans every commit in PR #47, so the deleted local test credential
in historical commit `3bbd1a5` continues to block the PR. The fork's public
`main` history must be rewritten to remove that literal from the PR range.

## What Changes

- Rewrite only the fork's `main` branch, replacing the historical local
  Supabase service-role JWT with a non-secret fixture placeholder.
- Force-push the rewritten branch using a captured SHA lease.
- Record the rewrite and verification result without printing the credential.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `cicd-security-gates`: Security remediation can remove an invalid local test
  credential from the public PR history without changing the current tree.

## Impact

This affects public Git object identities on the fork's `main` branch and PR
#47 only. It satisfies `NFR-SEC-03`, `T-12`, `Q-01`, and `NFR-OPS-04`.
