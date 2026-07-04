## ADDED Requirements

### Requirement: Feed Ingestion Parser
The ingestion worker SHALL fetch, validate, and parse RSS and Atom feed URLs. It SHALL extract item titles, descriptions, links, and publication dates using `fast-xml-parser`.

#### Scenario: Parse RSS Feed successfully
- **WHEN** feed fetch returns standard RSS XML content
- **THEN** parser successfully extracts title, description, link, and pubDate for each item

#### Scenario: Parse Atom Feed successfully
- **WHEN** feed fetch returns standard Atom XML content
- **THEN** parser successfully extracts title, summary, link, and updated timestamp for each item

### Requirement: Single Page Extraction Readability Scraper
The ingestion worker SHALL extract the primary text content and main title from HTML pages using `@mozilla/readability` and `linkedom` virtual DOM. It SHALL sanitize the extracted title and content to prevent injection attacks.

#### Scenario: Extract HTML article successfully
- **WHEN** scraper fetches raw HTML of a single article URL
- **THEN** readability module parses page structure and returns sanitized text content and main title

### Requirement: SSRF Validation on Redirects
The fetcher SHALL validate every HTTP redirect target URL against private, loopback, multicast, unique-local, link-local, reserved, and metadata IP ranges. It SHALL abort execution and throw an error if any redirect resolves to a forbidden range or if redirects exceed 5 hops.

#### Scenario: Redirect target violates SSRF range
- **WHEN** HTTP request is redirected to a loopback address `127.0.0.1` or link-local range
- **THEN** fetcher blocks the redirect, aborts the request, and records an operational event

#### Scenario: Redirect chain exceeds limit
- **WHEN** request chain redirects more than 5 times
- **THEN** fetcher aborts the request, increments source failure count, and logs a fetch failure event

### Requirement: Article Content Deduplication
The worker SHALL check URL uniqueness and fingerprint duplication before inserting articles. Duplicate articles SHALL be quietly filtered out without creating database constraint errors or breaking running ingestion executions.

#### Scenario: Deduplicate duplicate article URL
- **WHEN** article URL is already present in `public.ingested_articles`
- **THEN** worker skips database insertion and continues processing without throwing constraint errors

### Requirement: Source Health Monitoring and Automatic Pausing
The system SHALL track consecutive fetch failures for each global source. On fetch failure, the system SHALL increment the source's `failed_fetch_count` and log an event. If the count reaches 5 consecutive failures, the source status SHALL be updated to `paused` and an alert logged. On successful fetch, the failure count SHALL be reset to 0.

#### Scenario: Auto pause on 5 failures
- **WHEN** ingestion fetch fails for the 5th consecutive time
- **THEN** system updates `global_sources.status` to `paused` and logs a `source_disabled` operational event

#### Scenario: Reset failure count on success
- **WHEN** ingestion fetch succeeds for a source with non-zero failures
- **THEN** system resets `global_sources.failed_fetch_count` to 0
