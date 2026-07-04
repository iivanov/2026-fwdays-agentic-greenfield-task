## Why

The audit remediation backlog still has one evidence-hygiene gap before R-12:
several canonical OpenSpec specs retain placeholder `Purpose` text, and
historical archives can be confused with verified completion even when they lack
checker reports or complete task checklists.

## What Changes

- Replace generated placeholder canonical spec purposes with concise
  traceability-oriented purposes.
- Add a runnable hygiene test that rejects placeholder canonical purposes.
- Add a runnable hygiene test that requires every non-legacy archive to retain
  complete tasks plus separate verifier and reviewer reports.
- Document legacy archive gaps without editing old task checkboxes or inventing
  retrospective verification evidence.

## Upstream IDs

- AT-01
- AT-11
- Q-01
- Q-02
- Q-05
- NFR-OPS-04

## Non-goals

- Rewriting historical R-01..R-11 task checkboxes.
- Fabricating verifier/reviewer reports for already-archived changes.
- Changing product behavior or runtime architecture.
