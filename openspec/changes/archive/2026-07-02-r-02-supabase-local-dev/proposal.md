## Why

We need to establish a local Supabase development environment to build and test our database schemas, Row Level Security (RLS) policies, database triggers, queues, and Edge Functions. This local stack allows us to replicate the production Supabase environment completely offline, without paying any hosting fees, and validate database migrations locally before deployment.

Satisfies: `T-03`, `T-14`.

## What Changes

- Initialize Supabase local project (`supabase init`).
- Configure `supabase/config.toml` for local dev (JWT settings, local API ports, disabling features not needed locally).
- Create a migration skeleton (`supabase/migrations/`) that will house future database schema changes.
- Add local helper scripts to start/stop the local stack (`supabase start`, `supabase stop`).
- Set up migration linting checks (`supabase db lint` or migration check commands) to validate that our local SQL runs successfully.

Non-goals:
- Writing the core database schema or RLS policies (deferred to R-04).
- Configuring production Supabase settings or deploying to the cloud.

## Capabilities

### New Capabilities
- `supabase-local-dev`: Establishes the local Supabase emulator stack and migration toolchain.

### Modified Capabilities
None.

## Impact

- **Local Development**: Developers can run `npx supabase start` to spin up a local PostgreSQL + Auth + Edge Function stack.
- **Repository Structure**: Adds the `supabase/` folder to the root of the project.
