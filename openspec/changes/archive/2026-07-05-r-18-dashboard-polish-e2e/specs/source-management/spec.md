## MODIFIED Requirements

### Requirement: Source Management Panel

The source management UI SHALL continue to support existing source connection
and removal behavior. The polished dashboard SHALL make source health visible by
showing active/paused state, failed fetch count, last fetched time, and warning
treatments for paused or repeatedly failing sources.

Upstream: `BR-SRC-01`, `BR-SRC-04`, `BR-SRC-06`, `NFR-UX-01`, `Q-04`

#### Scenario: Source warnings are visible from the dashboard

- **WHEN** an authenticated user has paused sources or sources with repeated
  fetch failures
- **THEN** the dashboard overview and source panel show a warning state with the
  source URL, status, failed count, and last fetched time
- **AND** healthy sources remain visually distinct from warning sources
