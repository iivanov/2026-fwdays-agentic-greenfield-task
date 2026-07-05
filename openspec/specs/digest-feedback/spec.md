# digest-feedback Specification

## Purpose
Define authenticated digest feedback capture and reporting: users can view
their retained digest history, see aggregate feedback counts, and set or clear
thumbs up/down feedback for digests owned by their flows without automatic
prompt adaptation.
## Requirements
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

The digest history UI SHALL remain available from the polished responsive
dashboard. Users SHALL be able to scan retained digest title, flow name, created
time, item count, and current feedback state, then set or clear thumbs feedback
without layout overlap on desktop or mobile.

Upstream: `BR-FLOW-08`, `BR-DEL-01`, `NFR-UX-01`, `Q-04`

#### Scenario: Digest feedback controls are responsive

- **WHEN** an authenticated user opens retained digest history at desktop or
  mobile widths
- **THEN** each digest row shows its title, flow, created time, item count, and
  feedback state
- **AND** thumbs-up, thumbs-down, and clear controls remain reachable without
  clipped text or overlapping controls
