## Why

Users need a way to manage their news interest topics, target languages for summaries and translation, and configure connected delivery channels to realize the goal of receiving personalized news digests. Providing this API CRUD endpoint and React UI completes the core profile customization loop.

## What Changes

- **API Routes**: Implemented `GET /profiles` and `PUT /profiles` endpoints inside the `api` edge function to fetch and update interests and language preferences.
- **Client Library**: Exported the Supabase client and shared types from `@news-aggregator/browser` with ESM NodeNext imports support.
- **React Frontend SPA**: Scaffolded the Vite-based React single-page application under `packages/browser/` (with Google Fonts, dark slate HSL color system, and responsive layout foundations).
- **Profile Dashboard UI**: Built a high-fidelity interactive settings panel (`ProfilePanel`) utilizing TanStack Query for caching and synchronizing user interests (interactive keyword pills) and language preferences.

## Capabilities

### New Capabilities

- `profile-management`: Allows users to fetch, update, and manage their interest keywords and target languages via the API Edge Function and React UI.

### Modified Capabilities

## Impact

- **Database**: Queries `public.profiles` table governed by RLS policies bound to `auth.uid()`.
- **API Edge Function**: Updates the router in `supabase/functions/api/helpers.ts` to delegate profiles requests to stateful handlers.
- **Vite SPA**: Sets up React, ReactDOM, React Router, and TanStack Query dependencies under `packages/browser`.
