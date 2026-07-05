## Why

R-19 turns the deployment decisions already made in `T-04`, `T-14`, and
`H-01..H-06` into reviewable repository configuration and operator scripts.
Without this slice, the project has working local/CI gates but no committed
Vercel frontend routing/security config or repeatable way to audit the
human-bootstrap deployment prerequisites.

## What Changes

- Add repository-owned Vercel static frontend configuration for the Vite SPA:
  build/output settings, client-side route fallback, and security/cache
  headers.
- Add idempotent, non-secret `infra/scripts/` audit/bootstrap helpers that
  validate the local repository and report human-gated provider/account/secret
  steps without mutating production or storing provider state.
- Add documented deployment handoff/checklist coverage for Supabase and Vercel
  bootstrap boundaries, aligned to $0 hosting and public repository constraints.
- Add verification coverage for deployment config shape and secret-safety
  expectations.

Non-goals:

- No production deploy, account creation, project linking, secret entry, paid
  feature enablement, branch-protection mutation, or provider state generation.
- No change to product runtime behavior, data model, RLS policies, queues, or
  Edge Function business logic.

## Capabilities

### New Capabilities

- `deployment-bootstrap`: Repository-owned deployment configuration and
  human-gated bootstrap/audit behavior for the Vercel static frontend,
  Supabase backend deploy handoff, and public-repository safety checks.

### Modified Capabilities

- `cicd-security-gates`: Extend the existing quality gate contract with
  deployment/audit validation for declarative config and non-secret bootstrap
  scripts.

## Impact

- Affected repository/config paths: `vercel.json`, `infra/scripts/`, npm
  scripts, `.env.example`, OpenSpec specs, `docs/state.md`,
  `docs/roadmap.md`, and `docs/development_process.md`.
- Upstream IDs satisfied/refined: `BR-PROJ-01..03`, `NFR-CON-04..08`,
  `NFR-OPS-04`, `A-01`, `A-06..A-07`, `AT-01`, `AT-11`, `T-04`, `T-13`,
  `T-14`, `H-01..H-06`, and `Q-03..Q-05`.
- External references checked on 2026-07-05: Vercel `vercel.json` project
  configuration, Vercel rewrites/headers, Supabase deployment/environment
  management, Supabase Edge Function deployment, and the Supabase changelog.
