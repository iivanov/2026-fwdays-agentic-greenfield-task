## ADDED Requirements

### Requirement: Targeted Public History Remediation
The repository SHALL support a targeted, auditable rewrite of a public source
branch when a confirmed non-production test credential blocks its pull request
solely because it appears in that pull request's history (satisfies
`NFR-SEC-03`, `T-12`, `Q-01`, and `NFR-OPS-04`).

#### Scenario: Rewritten pull-request branch
- **WHEN** the affected source branch is rewritten
- **THEN** the replacement branch excludes the credential from every reachable
  commit, preserves the pre-rewrite application tree, and is force-pushed with
  a SHA-pinned lease
