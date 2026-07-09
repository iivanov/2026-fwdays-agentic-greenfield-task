## Why

`supabase/functions/api/helpers.ts` has grown into a 1,300+ line module that mixes HTTP helpers, route dispatch, route implementations, digest shaping, prompt encryption helpers, and delivery-channel verification. Splitting it now improves maintainability for `T-01`, `T-03`, `T-06`, `T-09`, `T-12`, and `Q-*` work without changing product behavior.

## What Changes

- Split API helper internals into focused modules for HTTP utilities, shared API types, digest reports, flow prompt storage, delivery-channel config/verification, and routing.
- Keep `api/helpers.ts` as a compatibility export surface for existing tests and the Edge Function entrypoint.
- Preserve all API routes, response envelopes, validation, auth behavior, SSRF checks, prompt/config encryption, secret masking, and delivery-channel verification semantics.
- Non-goals: endpoint behavior changes, database schema changes, RLS/policy changes, API route additions, dependency changes, and secret/config changes.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `api-skeleton`: Clarify that API helper decomposition must preserve the existing route contract and stable helper import surface.

## Impact

- Affected code: `supabase/functions/api/` internals and `packages/browser/src/lib/api-helpers.test.ts` if source-level assertions need module-aware updates.
- No external API, database, auth, Supabase config, dependency, or secret handling changes.
- Verification uses existing API helper Vitest coverage plus Deno gates, OpenSpec validation, and scoped whitespace checks.
