## Why

To establish the data layer foundations for the news aggregator, we need to create the core database schemas, tables, relationships, and Row Level Security (RLS) policies within Supabase. Having the schema defined in database migrations allows subsequent application modules (e.g. Auth, Edge Functions) to interact with a structured and secure database locally and in production.

Satisfies: `D-01..06`, `A-02`, `NFR-SEC-02`.

## What Changes

- Create a Supabase database migration defining tables for:
  - Users and Profiles (`profiles`)
  - Sources (`global_sources`, `flow_sources`)
  - Flows (`processing_flows`)
  - Ingested content (`ingested_articles`, `source_item_fingerprints`)
  - Processing and fetch runs (`source_fetch_runs`, `processing_runs`)
  - Digests (`processed_digests`, `flow_articles`)
  - Delivery (`delivery_channels`, `flow_delivery_channels`, `digest_delivery_attempts`)
  - Operational health (`operational_events`, `integration_circuits`)
- Apply deny-by-default Row Level Security (RLS) on all user-owned tables.
- Bind select, insert, update, delete operations to authenticated users utilizing `auth.uid()`.

Non-goals:
- Hooking up Supabase OAuth providers (done in R-05).
- Implementing the API Edge Function logic (done in R-06).

## Capabilities

### New Capabilities
- `core-schema-rls`: Defines the core SQL database schema and enforces Row Level Security (RLS) controls.

### Modified Capabilities
None.

## Impact

- **Database**: Establishes all tables and indices required for daily cycles, deduplication, and retention.
- **Security**: Enforces strict user isolation at the database level.
