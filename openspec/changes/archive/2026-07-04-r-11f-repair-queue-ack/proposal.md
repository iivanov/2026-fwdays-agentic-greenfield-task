# R-11F Repair Queue Transactional Acknowledgement

## Purpose

Repair worker queue acknowledgement and delivery state transitions so jobs are acknowledged only after state commits, RPC errors fail closed, and exhausted retries are dead-lettered before ordinary work.

## Upstream IDs

- D-03..D-06
- A-04
- AT-02, AT-03, AT-05, AT-06
- NFR-REL-01..05

## Scope

- Add service-role RPCs that update domain run state and delete/archive pgmq messages in one database transaction.
- Make the worker fail closed on claim/ack/archive/state RPC errors.
- Correct delivery attempt states to `sending` and `delivered`, and error column to `error_message`.
- Retain bounded retries and operator-visible DLQ events without logging content or credentials.

## Non-goals

- Full ingestion, AI processing, or delivery provider implementations.
- Changing queue names, cron schedules, or product behavior.
