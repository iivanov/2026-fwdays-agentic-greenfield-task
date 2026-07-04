# scheduler-queue Specification

## Purpose
TBD - created by archiving change r-11-scheduler-queue. Update Purpose after archive.
## Requirements
### Requirement: Daily Scheduling of User Flows
The system SHALL scan for enabled user processing flows due for execution (matching frequency limits), insert cycle run records into `source_fetch_runs` and `processing_runs`, and enqueue corresponding ingestion jobs to the queue.

#### Scenario: Running daily schedule triggers due flows
- **WHEN** the `schedule-daily` function is triggered
- **THEN** it enqueues ingestion jobs for all active sources linked to due flows and creates pending run records

### Requirement: Asynchronous Background Processing Queue
The system SHALL support message queueing using `pgmq`. A worker SHALL claim messages, apply a visibility lease timeout (default 5 minutes), and execute the job runner skeleton.

#### Scenario: Worker claims and leases a queue message
- **WHEN** the `work` function polls the queue
- **THEN** it claims one message, locks it for other workers via lease timeout, and runs the job task

### Requirement: Dead-letter Queue for Exhausted Jobs
If a queue message fails execution 5 consecutive times, the system SHALL log an operator-visible event in `operational_events` and move the message to a dead-letter queue or archive it as failed.

#### Scenario: Message transitions to DLQ after 5 failures
- **WHEN** a message fails 5 consecutive times
- **THEN** the system archives the message in the dead-letter archive and records a failure event

### Requirement: Worker acknowledgement MUST be transactional with domain state
Worker success paths MUST commit domain state and queue acknowledgement in one database transaction. If the state mutation or queue delete fails, the worker MUST return an error and MUST NOT claim the message was completed.

#### Scenario: Success RPC fails
- **WHEN** a claimed job reaches the success acknowledgement step
- **AND** the database returns an RPC error
- **THEN** the worker returns a 500 response
- **AND** the response identifies the acknowledgement failure

### Requirement: Delivery worker state names MUST match the delivery attempt schema
Delivery attempt workers MUST use `sending`, `delivered`, and `failed` with `error_message` rather than generic run states or nonexistent error columns.

#### Scenario: Delivery job completes
- **WHEN** a delivery attempt job succeeds
- **THEN** the attempt is marked `delivered`
- **AND** the queue message is deleted in the same transaction

### Requirement: Exhausted retries MUST be archived before ordinary execution
Messages with more than five reads MUST be archived to the queue archive and logged as critical operational events without executing the job body.

#### Scenario: Retry count is exhausted
- **WHEN** a claimed message has read count greater than five
- **THEN** the worker archives it and records a critical DLQ event
- **AND** does not run the job body

### Requirement: Maintenance Cleanup Loop
The system SHALL run a cleanup loop every 30 minutes to recover expired visibility leases (older than 5 minutes) by resetting their visibility timeout and permanently delete articles, digests, and attempt logs older than 7 days.

#### Scenario: Recovering expired leases and purging old assets
- **WHEN** the `cleanup` function executes
- **THEN** it resets visibility on abandoned messages and purges historical data older than 7 days
