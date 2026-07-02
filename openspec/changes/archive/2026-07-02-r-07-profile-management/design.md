## Context

Currently, the user profile information resides in `public.profiles` under a deny-by-default RLS policy. To allow the frontend to access and update user preferences (interest keywords, target languages) without direct database exposure or hardcoded queries, we must expose `GET` and `PUT` HTTP methods via the single `api` edge function gateway, and implement a responsive settings panel in React.

## Goals / Non-Goals

**Goals:**
- Implement stateful profiles REST endpoints (`GET` / `PUT`) in the API edge function gateway applying active session authentication and Postgres RLS checks.
- Scaffold the React Vite application in `packages/browser/` using TypeScript, ESM NodeNext, Google Fonts, and HSL slate dark color system variables.
- Connect the frontend controls (keyword pills, checkboxes) to the Edge Function using TanStack Query, showing loading, saving, success, and error states.

**Non-Goals:**
- Building the flow manager UI (flows, sources, channels) or setting up Telegram/Slack integrations (reserved for subsequent phase releases).
- Setting up static Vercel build pipelines or production hosting environments.

## Decisions

### 1. Unified API Edge Function Route Handling
- **Rationale**: We routed `profiles` queries through the Deno `api` gateway helpers, rather than creating separate edge function directories. This maintains single entry point routing and allows shared helpers (CORS, envelope structures, validation) to be reused across all domain CRUD segments.
- **Alternative**: Separate `/profiles` edge function. *Rejected* due to cold start overhead and helper code duplication.

### 2. NodeNext ESM Imports Resolution
- **Rationale**: Monorepo standard compilation maps relative modules using explicit `.js` extensions. We configured typescript compile targets and adjusted imports to use `.js` to prevent compile-time crashes in incremental building.
- **Alternative**: `allowImportingTsExtensions` flag. *Rejected* because it is incompatible with `--composite` builds.

## Risks / Trade-offs

- **Risk**: Concurrent updates or race conditions when multiple tabs update profile settings.
- **Mitigation**: TanStack Query is configured to disable window refetching for settings, and profile saves utilize full payloads returning refreshed payloads from database triggers directly.
