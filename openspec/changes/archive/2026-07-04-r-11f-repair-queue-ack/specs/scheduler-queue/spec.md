# scheduler-queue Delta

## ADDED Requirements

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
