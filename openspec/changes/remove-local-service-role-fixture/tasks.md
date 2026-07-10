## 1. Runtime credential handoff

- [x] 1.1 Add a tested Node launcher that discovers local Supabase status and
  runs the integration Vitest command with scoped environment values.
- [x] 1.2 Update the root integration script and shared test setup to require
  runtime-discovered credentials with non-sensitive prerequisite errors.
- [x] 1.3 Remove the CI-wide status export and the Gitleaks allowlist.

## 2. Security evidence

- [x] 2.1 Update the development-process and state records with the finding,
  disposition, source remediation, and PR check-run action.
- [x] 2.2 Run focused unit/static/secret-scan gates and applicable local
  Supabase integration gates.
- [ ] 2.3 Obtain independent verifier and security-reviewer reports on the
  final diff, resolve findings, and archive after strict OpenSpec validation.
