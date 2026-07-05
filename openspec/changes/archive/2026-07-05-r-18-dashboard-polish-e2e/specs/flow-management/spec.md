## MODIFIED Requirements

### Requirement: Flow Management Panel

The flow management UI SHALL continue to support existing flow CRUD, enable,
disable, prompt-mode, and quota behavior. The polished dashboard SHALL also make
run status scannable by showing each flow's enabled state, last run, next run,
and available run outcome metadata without adding inline worker execution.

Upstream: `BR-FLOW-01`, `BR-FLOW-02`, `NFR-UX-01`, `NFR-PERF-02`, `Q-04`

#### Scenario: Flow status is visible from the dashboard

- **WHEN** an authenticated user views the dashboard overview or flow panel
- **THEN** each available flow exposes enabled state, last run, next run, and
  prompt mode in a compact status treatment
- **AND** the dashboard does not add a long-running browser request to execute
  the flow worker
