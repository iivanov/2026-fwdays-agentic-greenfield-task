# Application Architecture

This document derives logical responsibilities from the [business requirements](../1_business/requirements.md), [NFRs](../1_business/nfr.md), and [data decisions](../2_data/data_structure.md). Concrete products, languages, frameworks, libraries, and hosting providers are selected only in `4_technology`. Cross-cutting implementation rules are defined in [architecture tactics](architecture_tactics.md).

## 0. Upstream Decision Basis

| Architecture decision | Inputs | Result |
| --- | --- | --- |
| **A-01 — Browser/API boundary** | `BR-USER-*`, `BR-SRC-01`, `BR-FLOW-01`, `BR-DEL-06`, `NFR-UX-01`, `D-01` | Responsive browser application plus authenticated stateless API boundary. |
| **A-02 — Relational persistence** | `D-01..D-06`, `NFR-SEC-02`, `NFR-DATA-01` | Transactional relational storage with constraints, ownership isolation, locking, and cleanup. |
| **A-03 — Shared source coordination** | `BR-SRC-04`, `NFR-PERF-01`, `D-02` | Global source state and one source claim per processing cycle. |
| **A-04 — Durable asynchronous pipeline** | `NFR-PERF-02`, `NFR-REL-01..05`, `D-03..D-04` | Scheduler and durable ingestion, processing, delivery, retry, dead-letter, and maintenance work. |
| **A-05 — Integration adapters** | `BR-SRC-02..03`, `BR-DEL-02..05`, `NFR-PERF-04` | Replaceable source, AI, and output adapters isolated from domain logic. |
| **A-06 — Security boundary** | `NFR-SEC-01..06`, `D-01`, `D-04` | Deny-by-default authorization, encrypted secrets, SSRF controls, and signed webhooks. |
| **A-07 — Observable operations** | `NFR-OPS-01..03`, `D-06` | Correlated logs plus persistent sanitized failure state. |

## 1. Architecture Requirements

- **Browser application:** A responsive web framework must provide authentication, source and flow configuration, delivery-channel setup, execution status, digest history, and feedback controls.
- **Application API:** A stateless API boundary must authenticate requests, authorize every user-owned resource, validate input, enforce quotas, and expose the domain operations required by the browser application.
- **Relational storage:** Durable data must be stored in a relational database with transactions, foreign keys, uniqueness constraints, row-level user isolation, and support for flexible encrypted configuration values.
- **Low-latency shared state:** The system needs shared caching and coordination so a source is fetched at most once per update cycle and concurrent workers cannot perform the same work. This capability may use a dedicated fast store or the relational database when the selected scale and hosting model make that simpler.
- **Durable asynchronous work:** Ingestion, AI processing, delivery, retries, and cleanup must execute outside interactive API requests. Jobs must survive process restarts and use bounded retries, visibility/lease timeouts, and dead-letter handling.
- **Recurring scheduling:** A scheduler must start due daily flows, recover abandoned work, and run retention cleanup at least every 30 minutes.
- **External integrations:** Replaceable adapters must isolate the AI provider, OAuth providers, feeds/web pages, email, Telegram, Slack, and generic outbound webhooks from domain logic.
- **Observability:** Every API request and background job must emit structured logs with correlation identifiers. Failed or exhausted jobs must be visible to an operator.

The API, scheduler, and workers are logical components. They do not need to be independently deployed services for the initial scale.

## 2. Logical Components

### 2.1 Browser Application

Provides the dashboard for authentication, profile management, sources, processing flows, delivery channels, digests, and feedback. It communicates only through authenticated APIs and must not receive server credentials or unencrypted delivery secrets.

### 2.2 Application API

- Validates authenticated user sessions and resource ownership.
- Provides CRUD operations for profiles, sources, flows, and delivery channels.
- Enforces the five-flow quota and daily frequency constraint.
- Encrypts sensitive configuration before persistence.
- Exposes health and job-status information without leaking cross-user data.

### 2.3 Relational Data Store

Stores durable domain records, ingestion results, digests, delivery state, schedules, and job coordination state. Transactions and row locks provide the source-fetch and delivery pre-flight locks described in the data model.

### 2.4 Shared Cache and Coordination

- Reuses a source fetch across all subscribing flows during an update cycle.
- Stores only identifiers in queued jobs; article bodies and generated digests remain in relational storage.
- Applies an expiry of no more than 24 hours to any cached user news content.
- Treats cache loss as recoverable; durable work state remains in relational storage or a durable queue.

### 2.5 Background Processing

Workers consume small, independently retryable jobs:

1. **Ingestion:** Claims a due source, fetches it once, validates redirects and resolved addresses against the SSRF policy, extracts feed entries or readable page content, deduplicates items, records source health, and persists accepted articles.
2. **AI processing:** Claims a due flow, selects unprocessed articles, groups near-duplicates, truncates the input to the configured budget, applies the user's prompt, records usage, and persists one digest.
3. **Delivery:** Creates one attempt per configured channel, claims each attempt with a lease, sends it through the relevant adapter, and records success or retry state.
4. **Maintenance:** Deletes expired content, recovers expired leases, removes old queue messages and cache entries, and surfaces exhausted jobs.

## 3. Processing Flow

1. At the fixed daily processing time, the scheduler identifies enabled flows that are due.
2. The scheduler creates ingestion jobs for the distinct sources used by those flows. A source-cycle uniqueness key prevents duplicate fetches.
3. Ingestion workers save newly accepted articles and enqueue flow-processing jobs after all source jobs for the cycle have reached a terminal state.
4. A flow worker atomically claims articles not previously consumed by that flow, then performs deduplication, truncation, AI processing, and digest persistence.
5. The worker creates delivery attempts for the flow's channels. In-app delivery is complete when the digest is persisted.
6. Delivery workers send external messages with bounded network timeouts and retry transient failures with exponential backoff.
7. User feedback is stored against the digest for reporting. Automatic prompt adaptation is outside the initial release; changing prompts without an explicit, testable rule would make behavior non-deterministic.

If no new article is available for a flow, no empty digest is generated and the run is recorded as completed with a `no_content` outcome.

## 4. Reliability and Concurrency Rules

- Job handlers must be idempotent. Every job has a stable domain idempotency key.
- Queue messages contain record identifiers and metadata, never full article or digest content.
- A worker acknowledges a job only after its database transaction commits.
- A source fetch is unique per source and processing cycle.
- An article can be consumed by a flow only once; this is enforced by a relational uniqueness constraint.
- Delivery remains best-effort at-least-once because the supported external channels do not all provide idempotency keys.
- Network operations use a maximum 30-second timeout. Expired leases are recoverable after five minutes.
- A job is dead-lettered after five failed attempts and must create an operator-visible error; source health rules still pause a source after five consecutive failed fetch cycles.

## 5. Security and Data Lifecycle

- Production sign-in uses only the approved OAuth providers. Development-only password authentication must not be enabled in the production environment.
- Authorization is deny-by-default and enforced both at the API boundary and at the data layer where supported.
- Delivery credentials, provider tokens owned by the application, webhook URLs/signing secrets, and custom prompts are encrypted with authenticated encryption before storage. Encryption keys live only in the runtime secret store.
- User-supplied URLs are restricted to HTTP/HTTPS. Every initial host and redirect target must resolve to public addresses; loopback, private, link-local, multicast, and cloud metadata ranges are blocked.
- Outbound delivery webhooks require HTTPS in production, are signed, do not follow redirects, and apply the same public-address validation immediately before every attempt.
- Article content, digests, and delivery attempts are permanently removed after seven days, with cleanup scheduled every 30 minutes.
- Cached copies of user news content expire within 24 hours. Job history containing only identifiers and operational metadata may be retained longer if it cannot reconstruct deleted content.

## 6. Downstream Contract

The technology layer must implement `A-01..A-07`, `AT-01..AT-12`, and `D-01..D-06` while satisfying `NFR-CON-04..08`. Technology alternatives are judged against those inputs; convenience alone is not sufficient justification.
