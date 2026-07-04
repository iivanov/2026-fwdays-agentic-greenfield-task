## ADDED Requirements

### Requirement: Flow processing claims only new articles

The system SHALL process at most 50 newest articles from the flow's configured
sources that have not previously been claimed by the same flow, and SHALL record
claimed articles in `flow_articles` using the flow/article uniqueness boundary.

Upstream: `BR-FLOW-02`, `BR-FLOW-03`, `NFR-CON-02`

#### Scenario: New articles are claimed once

- **GIVEN** a processing job for a flow/day
- **AND** the flow's sources contain unclaimed ingested articles
- **WHEN** the worker runs
- **THEN** it inserts `flow_articles` claim rows for those articles
- **AND** excludes articles already claimed by that flow from the AI request

### Requirement: Empty processing runs complete as no content

The system SHALL mark a processing run as `no_content` and SHALL NOT create a
`processed_digests` row when the flow has no new articles to process.

Upstream: `BR-FLOW-03`

#### Scenario: No candidates

- **GIVEN** a processing job for a flow/day
- **AND** all configured source articles have already been claimed by the flow
- **WHEN** the worker runs
- **THEN** `processing_runs.status` is `no_content`
- **AND** no digest row is inserted
- **AND** the queue job can be acknowledged

### Requirement: Candidate articles are grouped and budgeted before AI

The system SHALL group near-duplicate stories using n-gram Jaccard similarity
before AI processing, SHALL truncate each article to 2,000 Unicode characters,
and SHALL cap total article text sent to the model at 60,000 Unicode characters.

Upstream: `BR-FLOW-04`, `NFR-PERF-03`, `NFR-CON-02`

#### Scenario: Duplicate stories and oversized content

- **GIVEN** article candidates containing near-duplicate story text
- **AND** one or more candidates exceed the configured text budget
- **WHEN** the worker builds the AI request
- **THEN** near-duplicates are represented as grouped source clusters
- **AND** no article contributes more than 2,000 characters
- **AND** total article text does not exceed 60,000 characters

### Requirement: Digest generation uses strict Responses output

The system SHALL call the OpenAI Responses API with the selected model
`gpt-5.4-mini`, `max_output_tokens` set to 4,000, and strict JSON-schema
structured output requiring digest `title`, `language`, and ordered sections.

Upstream: `BR-FLOW-05`, `BR-FLOW-06`, `T-11`, `NFR-CON-03`

#### Scenario: Structured digest is persisted

- **GIVEN** claimed article candidates and a valid OpenAI API response matching
  the strict digest schema
- **WHEN** the worker completes processing
- **THEN** it stores one `processed_digests` row for the processing run
- **AND** stores the model, total token usage, and provider request ID
- **AND** marks included `flow_articles` with the digest ID

#### Scenario: Provider or schema failure is sanitized

- **GIVEN** OpenAI is unavailable or returns malformed structured output
- **WHEN** the worker handles the processing job
- **THEN** it records a sanitized worker failure
- **AND** the error does not include article content, prompts, API keys, or
  provider response bodies
