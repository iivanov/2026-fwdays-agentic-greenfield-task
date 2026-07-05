## Context

R-13 persists `processed_digests` for completed flow runs and the core schema
already includes `processed_digests.user_feedback` with allowed values
`thumbs_up`, `thumbs_down`, and `none`. RLS and API routes already enforce
ownership for user-owned records. R-15 completes the browser/API surface for
`BR-FLOW-08` by letting users view retained digests, report feedback counts,
and update their own digest feedback.

## Goals / Non-Goals

**Goals:**

- Provide an authenticated digest history API that returns retained digests
  owned by the caller and aggregate feedback counts for reporting.
- Provide an authenticated feedback update API that validates the rating and
  updates only `processed_digests.user_feedback`.
- Add a dashboard panel with thumbs up/down controls and a clear feedback state.
- Prove validation, ownership, reporting, and UI behavior with automated tests.

**Non-Goals:**

- No automatic prompt adaptation or prompt mutation from feedback.
- No feedback history/audit table; the initial release stores one current
  feedback value per digest.
- No delivery, processing, or retention behavior changes.

## Decisions

- **Reuse `processed_digests.user_feedback` instead of adding a table.**
  Alternative considered: a separate feedback events table. Rejected because
  `BR-FLOW-08` only requires storing and reporting thumbs state in the initial
  release, and the data model already defines the field on `ProcessedDigest`.
- **Route feedback through the authenticated API.** Direct browser table updates
  are possible through RLS, but API routes keep validation, response envelopes,
  and ownership error behavior consistent with the rest of the dashboard.
- **Use service-role reads/writes only with explicit `user_id` joins.** The API
  may use `supabaseAdmin` to shape nested digest/flow data consistently, but
  every query MUST join `processing_flows` and filter `processing_flows.user_id`
  to the JWT-derived user ID. If the user-scoped update touches no row, the API
  returns not found/unauthorized.
- **Report counts from the same visible result set.** The list endpoint returns
  feedback counts calculated from only the caller's retained digest rows, so
  cross-user rows cannot affect reporting.

## Risks / Trade-offs

- **Current-value feedback loses rating history** -> Acceptable for the initial
  release because `BR-FLOW-08` does not require historical feedback events.
- **Service-role helper misuse could bypass RLS** -> Mitigated with explicit
  `user.id` filters in API queries and tests that simulate cross-user rows.
- **Dashboard could imply prompt learning** -> Mitigated by avoiding any prompt
  change path and by showing feedback only as digest reporting state.

## Migration Plan

No schema migration is required. Deploy the API and browser changes together;
rollback removes the new routes/UI while leaving existing digest rows and
feedback values intact.

## Open Questions

None.
