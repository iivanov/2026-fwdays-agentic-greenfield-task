## ADDED Requirements

### Requirement: Runtime logs SHALL be correlated and sanitized

Scheduler, cleanup, and worker invocations SHALL emit structured JSON logs that
include a correlation identifier and relevant domain identifiers while excluding
article content, digest text, prompts, provider tokens, credentials, webhook
URLs, and remote response bodies.

Upstream: `A-07`, `AT-10`, `D-06`, `NFR-OPS-01`, `NFR-OPS-02`, `T-12`

#### Scenario: Worker job is traceable without content

- **WHEN** a worker claims and completes, fails, requeues, or archives a job
- **THEN** logs include the correlation id, queue name, message id, job type,
  outcome, duration, and safe domain identifiers
- **AND** logs do not contain article bodies, digest text, prompts, credentials,
  webhook URLs, or provider response bodies

### Requirement: Critical operational events SHALL send deduplicated operator alerts

Critical unresolved `OperationalEvent` rows SHALL be eligible for one operator
email alert per deduplication key per cooldown window. Concurrent workers SHALL
claim alert sending atomically so duplicate reminders are suppressed.

Upstream: `A-07`, `AT-10`, `D-06`, `NFR-OPS-02`, `NFR-OPS-03`, `T-10`, `T-12`

#### Scenario: First critical event alerts once

- **WHEN** a critical operational event is recorded for a deduplication key
- **THEN** exactly one worker can claim and send the operator alert
- **AND** the alert payload contains only severity, category, event id,
  occurrence count, and sanitized context identifiers

#### Scenario: Duplicate critical event is suppressed

- **WHEN** the same unresolved critical event recurs before the cooldown window
  expires
- **THEN** no second operator email is sent
- **AND** the event occurrence count remains updated in durable storage

### Requirement: AI usage guardrails SHALL fail closed before budget exhaustion

The processing worker SHALL enforce configured AI token budgets before and after
provider calls. When a daily or per-response budget is exhausted, the worker
SHALL fail closed, record a sanitized `provider_quota` operational event, and
avoid persisting a digest for that failed attempt.

Upstream: `D-03`, `D-06`, `A-07`, `AT-12`, `NFR-CON-03`, `NFR-CON-04`,
`NFR-CON-06`, `NFR-OPS-03`, `T-11`, `T-12`

#### Scenario: Daily budget exhausted before provider call

- **WHEN** the configured daily AI token budget is already reached
- **THEN** the worker does not call the AI provider
- **AND** records a `provider_quota` operational event with IDs and counters
  only
- **AND** the processing run is failed and the queue message is acknowledged
  terminally so the job is not retried for the same budget exhaustion

#### Scenario: Provider response exceeds per-response budget

- **WHEN** a provider response reports token usage above the configured
  per-response budget, including a malformed response that would otherwise be
  eligible for schema repair
- **THEN** the worker fails before persisting a digest
- **AND** does not make a schema-repair provider call for the same over-budget
  response
- **AND** records a sanitized `provider_quota` operational event
- **AND** records the failed response usage in content-free operational metadata
  before acknowledging the work terminally
