## Context

Ingestion and personalization briefs are organized into independent processing flows. To allow domain isolation, users require CRUD interfaces for managing up to 5 flows.

## Goals / Non-Goals

**Goals:**
- Expose `/flows` endpoints (`GET`, `POST`, `PUT`, `DELETE`) with user authorization checks.
- Support route parameter parsing for flow IDs (e.g. `/flows/:id`).
- Enable custom prompt templates and default predefined choices.
- Implement the `FlowsPanel` React component managing all brief details.

**Non-Goals:**
- Triggering flow executions manually or scheduling pipeline runs.
- Defining delivery channels on this panel (handled in R-10).

## Decisions

### 1. Route Parameter ID Extraction
- **Rationale**: The edge function router is path-based. We extract the second segment in the split path array (e.g. `/functions/v1/api/flows/<id>`) to determine the target resource UUID for updates and deletions.
- **Alternative**: Passing target IDs in query parameters. *Rejected* as standard REST guidelines prefer path segment IDs for single resource updates.

### 2. Trigger-based Quota Enforcement
- **Rationale**: Quota checks are handled at the database layer to prevent concurrency write limits bypass. The API POST route intercepts insert database errors and transforms quota exceptions into user-friendly validation messages.

## Risks / Trade-offs

- **Risk**: Deleting a flow deletes connected source links (`flow_sources` cascade).
- **Mitigation**: The UI must display confirmation modals warning users that removal is permanent.
