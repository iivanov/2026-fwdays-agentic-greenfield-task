# R-06 Design: API Edge Function Skeleton

## Decision: Single Gateway Edge Function

Rather than deploying multiple separate Edge Functions, the backend will use a
single `api` Edge Function. Paths are routed dynamically:
- `/functions/v1/api/health` -> Public health check.
- `/functions/v1/api/profiles/*` -> User profiles (auth required).
- `/functions/v1/api/sources/*` -> Feed sources (auth required).
- etc.

This reduces cold starts and allows sharing CORS/auth/Zod middlewares without
duplicate bundle overhead or import mappings.

## Decision: JWT Verification and RLS Context

We use `@supabase/server`'s `withSupabase` utility. It handles setting up `ctx.supabase` and `ctx.supabaseAdmin`.
We enforce that all routes except `/health` must check `ctx.supabase.auth.getUser()`.
If the user is not authenticated, we return a `401 Unauthorized` response immediately.

By querying the database using `ctx.supabase` instead of `ctx.supabaseAdmin`, Postgres RLS policies (configured in R-04/R-05) are automatically applied to the connection. This provides defense-in-depth enforcement of data isolation.

## Decision: Response Envelope Format

All responses must match the type:
```typescript
interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}
```

Helpers `sendSuccess(data, status = 200)` and `sendError(message, status = 400)` ensure consistent responses.

## Decision: Input Validation

We use `zod` for request body schema validation. If the schema validation fails, we return a `400 Bad Request` containing a compiled Zod error details array in the `error` field.
