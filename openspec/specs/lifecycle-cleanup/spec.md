# lifecycle-cleanup Specification

## Purpose
Define lifecycle cleanup guarantees for retained news content, operational
metadata, abandoned worker leases, dead-letter visibility, and durable
queue/cache payload posture (`BR-DATA-01..02`, `NFR-DATA-01..03`,
`NFR-REL-01/05`, `NFR-OPS-02`, `A-04`, `AT-06`, `AT-08`).
## Requirements
### Requirement: Cleanup SHALL purge retained content within the SLA

The system SHALL run cleanup at least every 30 minutes and SHALL permanently
delete content-bearing ingested articles, processed digests, and digest delivery
attempts older than seven days.

Upstream: `BR-DATA-01`, `NFR-DATA-01`, `D-05`, `A-04`, `AT-08`

#### Scenario: Expired content is purged

- **WHEN** cleanup runs with article, digest, and delivery attempt rows older
  than seven days
- **THEN** those content-bearing rows are deleted
- **AND** the cleanup cadence is frequent enough to keep purge lag under one
  hour

### Requirement: Cleanup SHALL recover abandoned leases

The system SHALL recover source fetch runs, processing runs, and delivery
attempts whose processing/sending leases are older than five minutes.

Upstream: `NFR-REL-01`, `NFR-REL-05`, `D-05`, `A-04`, `AT-06`

#### Scenario: Stale leases return to pending

- **WHEN** cleanup runs with stale source, processing, or delivery leases
- **THEN** those records are reset to pending state and can be retried

### Requirement: Cleanup SHALL preserve sanitized operational visibility

The system SHALL keep unresolved operational failures visible, delete only
resolved operational metadata after its metadata lifecycle, and surface
exhausted queue work as sanitized operational events.

Upstream: `BR-DATA-02`, `NFR-OPS-02`, `D-06`, `A-04`, `AT-06`, `AT-08`

#### Scenario: Unresolved failures are retained

- **WHEN** cleanup runs with unresolved operational failure rows older than 30
  days
- **THEN** unresolved rows remain visible to operators

#### Scenario: Exhausted retries are surfaced

- **WHEN** a queue job exceeds the retry limit
- **THEN** it is archived and a sanitized `dlq_exhaustion` operational event is
  recorded

### Requirement: Durable cache SHALL NOT extend content retention

The system SHALL NOT keep a separate durable news-content cache outside the
domain records governed by lifecycle cleanup. Any queue/cache payloads SHALL
contain identifiers and sanitized operational metadata only.

Upstream: `BR-DATA-02`, `NFR-DATA-02`, `NFR-DATA-03`, `D-05`, `AT-08`

#### Scenario: No separate durable news cache exists

- **WHEN** cleanup lifecycle is assessed
- **THEN** persisted news content is limited to domain content records subject
  to cleanup
- **AND** durable queue messages do not contain article bodies, digest text,
  prompts, or credentials
