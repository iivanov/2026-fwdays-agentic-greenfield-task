# r-14-delivery-workers

## Why

R-13 persists digests but the pipeline does not yet create durable delivery
attempts or send those digests through the configured output channels. This
breaks the delivery contract for email, Telegram, Slack, generic signed
webhooks, and in-app attempt visibility, and it leaves retry/circuit behavior
below the reliability requirements.

## What Changes

- Create one durable delivery attempt for every active channel mapped to a flow
  when a digest is persisted, with one ID-only `delivery-queue` message per
  attempt.
- Implement the delivery worker adapters for in-app, Brevo transactional email,
  Telegram bot messages, Slack incoming webhooks, and generic signed webhooks.
- Add bounded timeout, retry/backoff classification, channel failure accounting,
  and shared provider/origin circuit breaker state for delivery failures.
- Cover the behavior with focused worker and SQL integration tests, including
  webhook signing and permanent-vs-transient failure paths.

## Upstream IDs

`BR-DEL-02..05`, `BR-DEL-06`, `D-04`, `D-06`, `A-04`, `A-05`, `A-06`,
`NFR-PERF-04`, `NFR-REL-02..04`, `NFR-REL-05`, `NFR-SEC-04..05`, `NFR-SEC-06`,
`T-09`, `T-10`.

## Non-Goals

- UI polish for delivery status/history beyond the existing data surface.
- Feedback capture or digest ratings (`R-15`).
- Operator alert email deduplication and quota monitoring (`R-17`).
- Human provider setup, secret provisioning, or paid account actions.
