## Context

To support all data persistence and security requirements, we must provision tables corresponding directly to the data entities defined in `docs/architecture/2_data/data_structure.md`. Each table must enforce its foreign keys, uniqueness constraints, index definitions, and Row Level Security (RLS) policies.

## Goals / Non-Goals

**Goals:**
- Implement all database tables (`profiles`, `delivery_channels`, `global_sources`, `processing_flows`, `flow_sources`, `flow_delivery_channels`, `ingested_articles`, `source_item_fingerprints`, `source_fetch_runs`, `processing_runs`, `processed_digests`, `flow_articles`, `digest_delivery_attempts`, `operational_events`, `integration_circuits`).
- Enforce RLS policies for user-owned tables (`profiles`, `delivery_channels`, `processing_flows`, `flow_sources`, `flow_delivery_channels`, `flow_articles`, `processed_digests`, `digest_delivery_attempts`).
- Disallow any unauthenticated public access (deny-by-default).
- Enable RLS policies checking `auth.uid() = user_id`.

**Non-Goals:**
- Creating custom database triggers or functions for auth-sync (handled in R-05).
- Configuring API handlers (handled in R-06).

## Decisions

- **Table Naming**: Use plural snake_case matching the documentation entities.
- **RLS Policy Design**:
  - Enable RLS on every table.
  - User-owned tables check `auth.uid() = user_id`.
  - Shared read-only/write tables like `global_sources`, `ingested_articles`, etc., will restrict access to authenticated workers/functions and authenticated users based on least-privilege.
- **Indices**:
  - Add indexes on foreign keys to support fast joins.
  - Composite indexes on cyclical run metadata (`(source_id, cycle_date)`, `(flow_id, cycle_date)`).
