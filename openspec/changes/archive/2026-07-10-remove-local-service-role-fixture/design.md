## Context

Integration tests require a Supabase `service_role` key to exercise local Auth,
database triggers, and Edge Functions. The Supabase CLI already exposes the
credentials of a running local stack through `supabase status -o env`. CI
currently exports that status to all later workflow steps, while the test helper
also retains a committed default JWT fallback.

## Goals / Non-Goals

**Goals:**

- Run local integration tests without developers manually providing a key.
- Keep the local privileged credential out of tracked source and command logs.
- Give missing-stack failures actionable start/reset guidance.
- Keep CI and local execution on the same credential-discovery path.

**Non-Goals:**

- Change hosted Supabase credentials, project configuration, or production
  authentication.
- Generate a random JWT: it would not be signed by the running local stack and
  would fail Supabase authentication.
- Rewrite public Git history; the existing GitGuardian finding is closed as a
  documented local test credential after source remediation.

## Decisions

1. Add a Node launcher around Vitest that invokes `supabase status -o env`,
   parses the CLI's `API_URL` and `SERVICE_ROLE_KEY` output, and passes mapped
   `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` values only to its child
   process. The launcher never writes the values to stdout/stderr.

   Alternative: require shell `eval` commands or manually set variables. This
   is error-prone, encourages secret handling, and causes local and CI behavior
   to diverge.

2. Keep the shared setup helper responsible for validating required runtime
   environment values and preserving its existing health check. Its error names
   the required local-stack commands but does not reveal a value.

3. Remove the CI status-export step because the launcher scopes the credential
   to integration tests. Remove the Gitleaks exception once no literal remains.

## Risks / Trade-offs

- [CLI output changes] -> Validate required keys explicitly and fail with
  actionable guidance instead of running against an unknown environment.
- [Local stack unavailable] -> Keep health checks and report the start/reset
  prerequisite without leaking CLI output.
- [Historical PR finding remains] -> Use GitGuardian's `test credential` skip
  action, documented with the official CLI reference and the source-removal
  commit.
