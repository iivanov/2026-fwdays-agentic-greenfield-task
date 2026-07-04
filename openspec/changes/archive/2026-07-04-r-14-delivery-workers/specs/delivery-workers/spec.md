# delivery-workers Specification

## ADDED Requirements

### Requirement: Digest persistence SHALL enqueue active channel delivery attempts

When a digest is persisted for a flow, the system SHALL create exactly one
`digest_delivery_attempts` row for each active delivery channel mapped to that
flow and SHALL enqueue one `delivery-queue` message containing only the attempt
ID (satisfies `BR-DEL-06`, `D-04`, `A-04`, `NFR-DATA-03`).

#### Scenario: Active mapped channels receive attempts

- **WHEN** a flow digest is persisted and the flow has active email, Slack, and
  webhook channels
- **THEN** the system creates one pending attempt per channel
- **AND** it enqueues one delivery job per attempt with no digest text or
  credentials in the payload

#### Scenario: Disabled and pending channels are skipped

- **WHEN** a flow digest is persisted and mapped channels are not active
- **THEN** no delivery attempts or queue jobs are created for those channels

### Requirement: Delivery worker SHALL send each supported channel type

The delivery worker SHALL dispatch claimed attempts through in-app, Brevo email,
Telegram bot, Slack incoming webhook, and generic signed webhook adapters
(satisfies `BR-DEL-02..05`, `T-10`, `A-05`).

#### Scenario: Email delivery uses the verified recipient

- **WHEN** an email delivery attempt is processed
- **THEN** the worker sends via Brevo using the encrypted verified recipient
  from the channel config
- **AND** it never accepts a recipient from the queue payload

#### Scenario: Generic webhook delivery is versioned and signed

- **WHEN** a generic webhook delivery attempt is processed
- **THEN** the worker POSTs schema version `1` JSON with stable event ID equal
  to the delivery attempt ID
- **AND** it signs the exact raw body with the channel signing secret using
  HMAC-SHA256

### Requirement: Webhook adapters SHALL enforce outbound safety on every attempt

Slack and generic webhook delivery attempts SHALL validate user-configured URLs
immediately before the request, block non-public targets, and reject redirects
(satisfies `NFR-SEC-05`, `A-06`).

#### Scenario: Redirect response is not followed

- **WHEN** a Slack or generic webhook endpoint responds with any redirect
- **THEN** the worker treats the attempt as a failure without following the
  redirect

### Requirement: Delivery failures SHALL use bounded retries and circuit breakers

Transient delivery failures SHALL retry with bounded exponential backoff, update
provider/origin circuit state, and eventually become operator-visible on queue
exhaustion. Permanent delivery failures SHALL fail the attempt and acknowledge
the queue item without retry (satisfies `NFR-REL-02..04`, `NFR-PERF-04`,
`D-06`).

#### Scenario: Rate limit response schedules retry

- **WHEN** a delivery adapter receives HTTP 429 with a valid `Retry-After`
- **THEN** the attempt is marked failed with an eligible retry time at least as
  late as the provider delay
- **AND** the related circuit records the transient failure

#### Scenario: Permanent 4xx response is acknowledged

- **WHEN** a delivery adapter receives a non-retryable 4xx response
- **THEN** the attempt is marked failed
- **AND** the queue message is acknowledged so it is not retried

#### Scenario: Open circuit skips provider call

- **WHEN** the integration circuit for a provider or webhook origin is open and
  its next probe time has not arrived
- **THEN** the delivery worker fails the attempt as transient without calling
  the external provider
