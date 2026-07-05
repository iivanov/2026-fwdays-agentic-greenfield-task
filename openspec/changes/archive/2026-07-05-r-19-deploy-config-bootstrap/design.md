## Context

R-19 implements the deployment surface selected by `T-04`, `T-14`, and
`H-01..H-06`: Vercel hosts only the static React/Vite frontend, Supabase owns
all stateful/runtime backend behavior, and human-owned provider bootstrap stays
outside automation when it requires accounts, secrets, spend, or production
deployment. The current repository already has migrations, Supabase local
config, Edge Functions, GitHub quality gates, and browser e2e coverage, but it
lacks `vercel.json` and `infra/scripts/` audit/bootstrap files.

Official provider checks on 2026-07-05 confirm the intended approach:
Vercel supports repository-owned `vercel.json` project configuration,
rewrites, and headers; Supabase documents CLI project linking, migration
deployment, Edge Function deployment, and GitHub Actions automation. The
Supabase changelog includes recent Data API auto-exposure and Node/Postgres
deprecation changes, but they do not change this config-only slice because no
new table or runtime dependency is introduced.

## Goals / Non-Goals

**Goals:**

- Commit Vercel static frontend configuration for the browser workspace,
  including SPA fallback and security/cache headers.
- Add idempotent `infra/scripts/` validation that checks repository-owned
  deployment config, local Supabase deploy readiness, and human-bootstrap
  prerequisites without reading or printing secret values.
- Add root npm scripts so CI/checkers can run deployment config validation with
  the same command surface as other gates.
- Update OpenSpec/docs state and process records with truthful evidence and
  remaining human bootstrap boundaries.

**Non-Goals:**

- No Vercel project linking, `.vercel/` state, Supabase remote linking,
  database migration deployment, Edge Function deployment, GitHub ruleset
  mutation, or secret entry.
- No production CORS/Auth redirect changes that depend on the final hosted URL.
- No provider API calls that require credentials. Any command needing
  credentials remains a documented human action or a future protected CI step.

## Decisions

1. **Vercel configuration stays at the repository root.**
   - Decision: add root `vercel.json` with Vite framework settings,
     `packages/browser` install/build/output paths, one SPA fallback rewrite,
     and response headers.
   - Alternative considered: place config in `packages/browser`. This is less
     clear for a monorepo import and would not provide a single repo-level
     deployment contract.
   - Rationale: `H-01` and `T-14` name `vercel.json` as the repository-owned
     frontend deploy config. Root configuration keeps CI/audit simple.

2. **Do not proxy Supabase APIs through Vercel.**
   - Decision: Vercel serves static assets only; the browser calls Supabase via
     `VITE_SUPABASE_URL`.
   - Alternative considered: add `/api/:path*` external rewrites. This adds
     cache/proxy behavior and CORS/security ambiguity without an upstream need.
   - Rationale: `H-01` explicitly excludes Vercel backend behavior. Avoiding
     external-origin rewrites also avoids accidental caching of authenticated
     Supabase responses.

3. **Audit/bootstrap scripts are read-only and local-first.**
   - Decision: add Node scripts under `infra/scripts/` that validate committed
     files, required env variable names, ignored provider-state paths, and
     human-gated checklist items. They may inspect files and environment names
     but must not print values or call provider mutation APIs.
   - Alternative considered: use Vercel/Supabase/GitHub APIs directly. That
     would need credentials and could mutate external state, violating the
     human-bootstrap boundary for this slice.
   - Rationale: `AT-01` requires idempotent commands and read-only audit before
     mutation. For this single environment, repo-local audit gives useful
     repeatability without state storage.

4. **Security headers are conservative for a static SPA.**
   - Decision: add nosniff, referrer, frame, permissions, HSTS, and a CSP that
     allows the static app plus HTTPS connections to Supabase/provider origins.
   - Alternative considered: defer CSP until production URL is known. This
     would leave the deployment config incomplete. A conservative broad-HTTPS
     `connect-src` is acceptable for the current SPA and can be tightened after
     final project URLs exist.

## Risks / Trade-offs

- **CSP can be too broad before production URLs exist** -> Use a safe baseline
  that blocks framing/object execution and avoids inline script allowances; add
  a documented future tightening step after human bootstrap provides exact
  Supabase/Vercel domains.
- **Audit script cannot prove hosted settings without credentials** -> Report
  those checks as human-bootstrap/pending, not pass. Hosted proof remains CI and
  provider-console evidence after bootstrap.
- **Provider CLI behavior changes** -> Keep scripts focused on repository
  invariants and validate with current docs. Deployment commands remain in docs
  and protected CI/future scripts after provider linking exists.
- **Vercel monorepo settings can drift from dashboard overrides** -> Commit
  install/build/output settings in `vercel.json` and have the audit script
  assert them.

## Migration Plan

1. Add OpenSpec artifacts and repository deployment/audit files.
2. Run local config validation, format/lint/type/test gates, browser build,
   e2e, OpenSpec strict validation, and `git diff --check`.
3. Run independent verifier and reviewer sub-agents on the final diff.
4. Archive the change, commit, push to `main`, and monitor GitHub CI/CodeQL.
5. Human bootstrap later links Vercel/Supabase projects, enters secrets, and
   provides hosted evidence; this slice does not perform those actions.
