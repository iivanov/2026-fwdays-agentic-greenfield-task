# scheduler-queue Delta

## ADDED Requirements

### Requirement: Cleanup MUST enforce distinct content and metadata lifecycles

Cleanup MUST permanently delete content-bearing article, digest, and delivery
attempt data after seven days while retaining sanitized run metadata for 30 days.

#### Scenario: Expired content is deleted before metadata

- **WHEN** cleanup runs with content rows older than seven days and run metadata
  newer than 30 days
- **THEN** expired article/digest/delivery content is deleted
- **AND** source and processing run metadata remains.

### Requirement: Cleanup MUST retain unresolved operational failures

Cleanup MUST keep unresolved operational failures visible and delete only
resolved operational metadata after 30 days.

#### Scenario: Unresolved failure is older than 30 days

- **WHEN** an unresolved `operational_events` row is older than 30 days
- **THEN** cleanup retains the row.

#### Scenario: Resolved metadata is older than 30 days

- **WHEN** a resolved `operational_events` row is older than 30 days
- **THEN** cleanup deletes the row.

### Requirement: Cleanup MUST preserve active integration circuits

Cleanup MUST delete only closed stale integration circuits and MUST retain open
or half-open circuit state.

#### Scenario: Active circuit is stale

- **WHEN** an `integration_circuits` row is `open` or `half_open` and older than
  30 days
- **THEN** cleanup retains the row.

#### Scenario: Closed circuit is stale

- **WHEN** an `integration_circuits` row is `closed` and older than 30 days
- **THEN** cleanup deletes the row.
