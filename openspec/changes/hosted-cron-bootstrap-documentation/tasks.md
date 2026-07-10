## 1. Documentation and traceability

- [ ] 1.1 Update the canonical hosting deployment record with the explicit,
  project-specific hosted-cron runtime bootstrap boundary (`T-05`, `T-06`,
  `T-14`, `H-02`, `H-06`, `NFR-SEC-03`, `NFR-OPS-04`).
- [ ] 1.2 Update the operator deployment guide with ordered bootstrap,
  read-only verification, and DNS/authorization/outdated-schedule diagnostics
  that do not expose credentials.
- [ ] 1.3 Update the final deployment order and smoke checklist so a manual
  `curl` is not accepted as evidence of automatic cron health.
- [ ] 1.4 Record the observed hosted DNS failure, the documentation correction,
  and only the checks actually run in `docs/development_process.md` and
  `docs/state.md`.

## 2. Maker checks

- [ ] 2.1 Run `git diff --check`, validate changed local links/paths, verify
  OpenSpec traceability, and run strict OpenSpec validation.

## 3. Independent checks

- [ ] 3.1 Have a separate verifier run the documentation gates and save a
  verification report in this change.
- [ ] 3.2 Have a separate reviewer inspect the final diff for deployment
  correctness, security/secret exposure, and traceability, then save a review
  report in this change.
