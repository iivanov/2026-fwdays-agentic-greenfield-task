## 1. SSRF Defense Implementation

- [x] 1.1 Create `supabase/functions/api/ssrf.ts` module with private/reserved IP blocks matching arrays.
- [x] 1.2 Implement environment-agnostic DNS resolvers (Deno/Node.js compatibility).
- [x] 1.3 Add SSRF unit test file `packages/browser/src/lib/ssrf.test.ts`.

## 2. API Sources CRUD Routing

- [x] 2.1 Implement `GET /sources` with optional flow_id filter querying linked feeds.
- [x] 2.2 Implement `POST /sources` performing SSRF validations, admin-level global insert, and user linkage.
- [x] 2.3 Implement `DELETE /sources` disconnecting feeds from user flows.
- [x] 2.4 Add sources mock unit/integration test cases to `packages/browser/src/lib/api-helpers.test.ts`.

## 3. UI Implementation

- [x] 3.1 Create tab switches layout in `App.tsx` matching Outfit HSL themes.
- [x] 3.2 Add default flow auto-creation triggers in `SourcesPanel.tsx` preventing blank block states.
- [x] 3.3 Create settings forms and active list managers in `SourcesPanel.tsx` using React Query.

## 4. Verification & Testing

- [x] 4.1 Verify TypeScript type compiles cleanly.
- [x] 4.2 Run ESLint checks and formatters verifying zero compile errors or warnings.
- [x] 4.3 Execute Vitest suite ensuring 37/37 tests pass green.
- [x] 4.4 Build production browser bundle successfully.
