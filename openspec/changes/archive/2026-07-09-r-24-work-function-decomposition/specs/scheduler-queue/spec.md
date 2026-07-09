## ADDED Requirements

### Requirement: Worker decomposition MUST preserve the queue contract
The `work` Edge Function implementation MAY be decomposed into internal modules, but it MUST preserve the existing asynchronous worker contract for queue claiming, job execution, acknowledgement, retries, dead-letter archiving, operational logging, and delivery state transitions (`A-04`, `T-05`, `NFR-REL-01..05`, `T-12`).

#### Scenario: Decomposed worker processes jobs without behavior changes
- **WHEN** the decomposed `work` function claims ingestion, processing, or delivery jobs
- **THEN** it returns the same observable statuses and performs the same database RPCs and state transitions as the pre-decomposition worker

#### Scenario: Decomposed worker keeps the stable test import surface
- **WHEN** worker tests import `createWorkHandler`, `workHandler`, `ingestSource`, `processFlow`, `deliverAttempt`, and tested pure helpers from `supabase/functions/work/index.ts`
- **THEN** those exports remain available and behave as before
