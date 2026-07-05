## ADDED Requirements

### Requirement: Digest feedback SHALL be captured for owned digests

The system SHALL allow an authenticated user to set a retained digest's
feedback to `thumbs_up`, `thumbs_down`, or `none`, and SHALL update only
digests that belong to a flow owned by that user.

Upstream: `BR-FLOW-08`, `D-03`, `A-01`, `A-06`, `Q-01`, `Q-02`

#### Scenario: User rates an owned digest

- **WHEN** an authenticated user submits `thumbs_up` feedback for a digest
  produced by one of their flows
- **THEN** the digest's `user_feedback` is stored as `thumbs_up`
- **AND** the response contains the digest ID and updated feedback value

#### Scenario: User clears feedback

- **WHEN** an authenticated user submits `none` for a previously rated digest
- **THEN** the digest's `user_feedback` is stored as `none`
- **AND** no flow prompt fields are changed

#### Scenario: Invalid feedback is rejected

- **WHEN** an authenticated user submits feedback outside `thumbs_up`,
  `thumbs_down`, or `none`
- **THEN** the API rejects the request before updating any digest row

#### Scenario: Cross-user digest is not updated

- **WHEN** an authenticated user submits feedback for a digest owned by a
  different user's flow
- **THEN** the API returns a not-found or unauthorized response
- **AND** the target digest feedback is not changed

### Requirement: Digest feedback SHALL be reported with digest history

The system SHALL expose an authenticated digest history report containing only
the caller's retained digests, each digest's current feedback value, and
aggregate counts for `thumbs_up`, `thumbs_down`, and `none`.

Upstream: `BR-FLOW-08`, `D-03`, `A-01`, `A-06`, `Q-01`, `Q-04`

#### Scenario: User views digest history and feedback counts

- **WHEN** an authenticated user opens digest history
- **THEN** the API returns only digests belonging to that user's flows
- **AND** each digest includes its flow ID/name, created timestamp, structured
  digest content, and `user_feedback`
- **AND** the report includes feedback counts calculated from the same returned
  digest set

#### Scenario: User changes feedback from the dashboard

- **WHEN** a user clicks thumbs up or thumbs down for a visible digest
- **THEN** the dashboard persists the new feedback through the authenticated API
- **AND** the visible digest row and feedback counts update without modifying
  the flow's prompt configuration
