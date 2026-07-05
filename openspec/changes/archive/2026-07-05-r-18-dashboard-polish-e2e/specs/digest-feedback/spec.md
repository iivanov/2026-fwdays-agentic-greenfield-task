## MODIFIED Requirements

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
