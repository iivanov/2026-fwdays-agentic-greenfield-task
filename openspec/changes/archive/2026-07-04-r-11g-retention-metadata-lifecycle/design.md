## Design

`cleanup_runs()` remains the single local cleanup RPC invoked by the `cleanup`
Edge Function. The repair is constrained to database lifecycle rules and tests:
no new runtime service or provider is introduced.

## Data Lifecycle Rules

- Seven-day physical deletion applies to content-bearing data:
  `processed_digests`, `digest_delivery_attempts` through digest cascade,
  `flow_articles` through digest/article relationships, and
  `ingested_articles`.
- `source_fetch_runs` and `processing_runs` contain sanitized run identifiers and
  error codes, not user/news content, so they are retained for 30 days.
- `operational_events` are deleted only when `resolved_at is not null` and the
  resolved timestamp is older than 30 days. Unresolved failures remain visible.
- `integration_circuits` are deleted only when `state = 'closed'` and
  `updated_at` is older than 30 days. Open and half-open circuit state remains.

## Security And Privacy

The cleanup result reports counts only. It does not return article content,
digest content, prompts, secrets, webhook URLs, or provider responses. No RLS
policy is relaxed; cleanup continues to run through service-role-only RPC access.

## Idempotency

The RPC is safe to rerun. Each deletion uses timestamp predicates and returns
counts for rows actually affected in that invocation. Repeated runs after the
first should report zero for already-deleted lifecycle classes.

## Verification

Add SQL-shape tests for the migration and Supabase integration coverage that
seeds expired content, expired resolved metadata, unresolved events, and active
circuits, then invokes the cleanup Edge Function and verifies the expected
retention behavior.
