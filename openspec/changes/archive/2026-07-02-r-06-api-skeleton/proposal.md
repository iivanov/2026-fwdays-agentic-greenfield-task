# R-06: API Edge Function Skeleton

## Summary

Provision the `api` Edge Function as a single gateway router for the
personalized news-aggregator web application. Implement standard CORS headers, JWT verification via the caller's token, input boundary validation with Zod, and `{data,error}` response envelope wrapping.

## Upstream IDs

A-01, A-06, NFR-SEC-02, AT-07, Q-01..03

## Scope

- Create a Deno Edge Function project under `supabase/functions/api/`.
- Implement a JWT verification middleware using the caller's token.
- Design a `{data,error}` JSON response helper for standard envelope formatting.
- Set up a CORS handler allowlist supporting local dev and wildcard fallbacks.
- Expose a Zod validation helper for incoming request bodies.
- Build a routing system that handles `/health` and wildcard endpoint matches.
- Add unit tests verifying mock JWT validation, CORS headers, envelope wrapping, and Zod verification in Deno/Vitest.

## Non-Goals

- Implementation of profiles CRUD logic (R-07).
- Ingestion, processing, or delivery worker logic (Phase 3).
