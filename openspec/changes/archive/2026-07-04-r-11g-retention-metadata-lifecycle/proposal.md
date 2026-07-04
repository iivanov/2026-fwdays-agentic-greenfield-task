## Why

The current cleanup RPC purges `source_fetch_runs`, `processing_runs`, and all
`operational_events` after seven days. That violates the data contract: user/news
content and delivery attempts are seven-day data, but content-free run metadata,
resolved operational events, and closed integration circuits may live for 30
days, while unresolved critical/exhausted failures must remain operator-visible
beyond short log retention.

## What Changes

- Correct `cleanup_runs()` so seven-day deletion targets content-bearing
  records only: ingested articles, processed digests, and delivery attempts via
  digest cascade.
- Retain sanitized `source_fetch_runs` and `processing_runs` for 30 days.
- Delete only resolved `operational_events` older than 30 days and retain
  unresolved events.
- Delete only closed `integration_circuits` whose `updated_at` is older than 30
  days and retain open/half-open circuit state.
- Return explicit cleanup counters for each lifecycle class.
- Add regression coverage proving unresolved failures are retained while expired
  content and eligible resolved metadata are purged.

## Upstream IDs

- BR-DATA-01, BR-DATA-02
- D-05, D-06
- AT-08
- NFR-DATA-01, NFR-DATA-02, NFR-DATA-03
- NFR-OPS-02

## Non-goals

- Changing the 30-minute cleanup schedule.
- Implementing cache storage outside the database.
- Adding user-visible operations screens.
- Changing source health, worker retry, or DLQ behavior outside retention.
