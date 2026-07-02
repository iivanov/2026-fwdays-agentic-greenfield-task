## 1. Deno Project Setup

- [x] 1.1 Add Zod import mapping to `supabase/functions/api/deno.json`.
- [x] 1.2 Setup Deno configuration settings for the Deno LSP (type definitions).

## 2. API Implementation

- [x] 2.1 Implement CORS headers mapping with OPTIONS preflight handler.
- [x] 2.2 Implement JWT validation wrapper utilizing `ctx.supabase.auth.getUser()`.
- [x] 2.3 Implement `{data,error}` JSON response envelope helpers.
- [x] 2.4 Implement Zod request body validation parser helper.
- [x] 2.5 Implement path-based router mapping `/health` (public) and dummy CRUD routes (auth required).

## 3. Testing & Verification

- [x] 3.1 Create test files verifying the API middleware (CORS, auth, validations) behavior.
- [x] 3.2 Verify all quality gates pass locally (lint, typecheck, format, Vitest).
- [x] 3.3 Spawn verifier sub-agent.
- [x] 3.4 Spawn reviewer sub-agent.
- [x] 3.5 Archive change upon pass.
