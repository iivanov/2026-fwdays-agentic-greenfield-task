## Why

R-16 is the Phase 4 lifecycle closure slice for `BR-DATA-01..02` and
`NFR-DATA-01..03`. Earlier remediation slices implemented much of the cleanup
runtime, but the lifecycle contract still needs one focused OpenSpec change and
final evidence tying together purge cadence, lease recovery, cache posture, and
dead-letter surfacing.

## What Changes

- Add a lifecycle cleanup specification covering seven-day content purge with
  the 30-minute cleanup cadence, 24-hour cache posture, lease recovery, and
  dead-letter surfacing.
- Reuse the existing cleanup runtime where it already satisfies R-16.
- Add lightweight regression coverage for any missing cleanup/schedule/DLQ
  evidence discovered during implementation.
- Update roadmap/state/process records and retain independent verifier/reviewer
  reports before archive.

## Capabilities

### New Capabilities

- `lifecycle-cleanup`: Maintenance cleanup, content/cache lifecycle, lease
  recovery, and dead-letter surfacing.

### Modified Capabilities

- `scheduler-queue`: Clarify the existing queue maintenance requirements that
  R-16 closes.

## Impact

- Upstream IDs: `BR-DATA-01`, `BR-DATA-02`, `NFR-DATA-01..03`,
  `NFR-REL-01`, `NFR-REL-05`, `NFR-OPS-02`, `D-05`, `D-06`, `A-04`,
  `AT-06`, `AT-08`, `Q-01`, `Q-03`, `T-05`, `T-12`.
- Affected files may include cleanup/queue tests, OpenSpec specs, and
  documentation records.
- No new provider, credential, table, or paid capability is expected.
