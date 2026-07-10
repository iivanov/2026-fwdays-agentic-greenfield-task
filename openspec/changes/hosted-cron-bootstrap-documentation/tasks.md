## 1. Documentation and traceability

- [x] 1.1 Add a portable Vault-backed cron repair migration that recreates all
  scheduled jobs without a URL, scheduler secret, or local-host fallback in
  `cron.job`.
- [x] 1.2 Add migration-source regression coverage for Vault configuration,
  missing-value failure, protected helper execution, and all three schedules.
- [x] 1.3 Update the canonical hosting deployment record with the explicit,
  project-specific hosted-cron runtime bootstrap boundary (`T-05`, `T-06`,
  `T-14`, `H-02`, `H-06`, `NFR-SEC-03`, `NFR-OPS-04`).
- [x] 1.4 Update the operator deployment guide with ordered Vault bootstrap,
  read-only verification, and DNS/authorization/outdated-schedule diagnostics
  that do not expose credentials.
- [x] 1.5 Update the final deployment order and smoke checklist so a manual
  `curl` is not accepted as evidence of automatic cron health.
- [x] 1.6 Record the hosted SQL permission failure, Vault repair, and only the
  checks actually run in `docs/development_process.md` and `docs/state.md`.

## 2. Maker checks

- [x] 2.1 Run focused migration tests, the local Supabase migration lint/reset
  when available, plus `git diff --check`, local link/path validation,
  traceability, and strict OpenSpec validation.

## 3. Independent checks

- [x] 3.1 Have a separate verifier run the documentation gates and save a
  verification report in this change.
- [x] 3.2 Have a separate reviewer inspect the final diff for deployment
  correctness, security/secret exposure, and traceability, then save a review
  report in this change.
