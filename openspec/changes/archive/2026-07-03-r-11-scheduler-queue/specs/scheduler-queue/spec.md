## ADDED Requirements

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

### Requirement: Maintenance Cleanup Loop
The system SHALL run a cleanup loop every 30 minutes to recover expired visibility leases (older than 5 minutes) by resetting their visibility timeout and permanently delete articles, digests, and attempt logs older than 7 days.

#### Scenario: Recovering expired leases and purging old assets
- **WHEN** the `cleanup` function executes
- **THEN** it resets visibility on abandoned messages and purges historical data older than 7 days
