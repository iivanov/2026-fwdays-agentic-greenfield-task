## Context

`api/helpers.ts` currently contains reusable HTTP helpers, route lifecycle/auth dispatch, route implementations for profiles/sources/flows/digests/channels, delivery-channel verification, and small domain formatting helpers. Existing tests import its public helpers directly, so this refactor must keep `helpers.ts` stable while moving implementation detail into smaller modules.

## Goals / Non-Goals

**Goals:**

- Keep `helpers.ts` as a compatibility barrel for the API Edge Function and tests.
- Move cohesive responsibilities into internal modules: `types.ts`, `http.ts`, `digest-report.ts`, `flow-prompts.ts`, `delivery-config.ts`, and `router.ts`.
- Preserve route behavior, response shapes, CORS behavior, Zod validation, user auth handling, RLS/client usage, encrypted prompt/config handling, SSRF protection, webhook signing, and masking.
- Update OpenSpec/process records and retain checker evidence.

**Non-Goals:**

- No endpoint changes or route additions.
- No database migrations, RLS changes, Supabase config changes, dependency changes, or provider behavior changes.
- No decomposition of `crypto.ts` or `ssrf.ts`; those modules are already focused enough for this slice.

## Decisions

- Use `helpers.ts` as a barrel re-export. This avoids churn in `api/index.ts` and existing tests while allowing internals to be maintained independently.
- Split route-adjacent helper logic by responsibility rather than by every URL path. The router stays in one module so path matching remains easy to audit.
- Keep Deno-compatible explicit `.ts` imports in all new Edge Function modules.
- Do not rewrite query logic while moving it; any semantic route changes require a separate OpenSpec change.

## Risks / Trade-offs

- Import cycles could appear between router and helper modules -> keep shared types and pure helper modules dependency-light, and make `router.ts` depend on them rather than the reverse.
- Moving route code could accidentally change auth/client choice -> preserve current `supabaseClient` and `supabaseAdmin` usage exactly and rely on API helper tests.
- Barrel exports can hide module ownership -> new modules are named by responsibility and `helpers.ts` remains intentionally thin.
