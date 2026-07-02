## 1. Setup & Environment Configurations

- [x] 1.1 Install React, Vite, React Router, and TanStack Query packages in `@news-aggregator/browser` workspace.
- [x] 1.2 Configure `vite.config.ts` running on strict port 3000 matching ALLOWED_ORIGINS.
- [x] 1.3 Add ESM NodeNext imports support and `vite/client` definitions in `tsconfig.json`.

## 2. API Edge Function Integration

- [x] 2.1 Implement `GET /profiles` endpoint querying profiles table filtered on user id.
- [x] 2.2 Implement `PUT /profiles` endpoint validating payload with Zod schema and updating settings.
- [x] 2.3 Write integration unit/mock tests in `packages/browser/src/lib/api-helpers.test.ts`.

## 3. UI Implementation

- [x] 3.1 Create `index.html` entry point referencing Outfit / Plus Jakarta Sans typography.
- [x] 3.2 Add styling tokens, slate HSL variables, and dark mode foundations in `index.css`.
- [x] 3.3 Create main mount `main.tsx` initializing React Query client.
- [x] 3.4 Design the high-fidelity authenticated dashboard and mock authentication handlers in `App.tsx`.
- [x] 3.5 Build interactive settings panel in `ProfilePanel.tsx` using pills, checklists, and state saving tags.

## 4. Verification & Testing

- [x] 4.1 Verify TypeScript type checking is clean.
- [x] 4.2 Run formatting and linter checks with zero warnings.
- [x] 4.3 Execute Vitest suite validating 20/20 test cases green.
- [x] 4.4 Build production assets bundle using Vite.
