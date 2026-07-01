# Data Structure

This data model is derived from the business layer. It describes information and integrity requirements without selecting a database product or ORM.

## 0. Upstream Decision Basis

| Data decision | Business inputs | Result |
| --- | --- | --- |
| **D-01 — User ownership** | `BR-USER-01..03`, `NFR-SEC-01..02`, `NFR-CON-01` | User profile, owned flows/channels, authentication identity reference, and enforceable ownership/quota boundaries. |
| **D-02 — Shared sources** | `BR-SRC-01..06`, `NFR-PERF-01`, `NFR-REL-03`, `NFR-SEC-05` | Globally unique source, source health, persistent fingerprints, articles, and one fetch run per source/day. |
| **D-03 — Deterministic flow runs** | `BR-FLOW-01..08`, `NFR-CON-02..03`, `NFR-OPS-03` | Flow schedule/configuration, one processing run per flow/day, article-consumption records, structured digests, feedback, and usage. |
| **D-04 — Multi-channel delivery** | `BR-DEL-01..06`, `NFR-REL-02..05`, `NFR-SEC-03..06` | Reusable delivery channels, flow/channel mapping, encrypted configuration, and one durable attempt per digest/channel. |
| **D-05 — Lifecycle** | `BR-DATA-01..02`, `NFR-DATA-01..03` | Content timestamps, cascades, seven-day deletion, content-free queue messages, and bounded operational metadata. |
| **D-06 — Operations** | `NFR-REL-02/05`, `NFR-PERF-04`, `NFR-OPS-01..03` | Sanitized persistent operational events, circuit state, and provider request/usage metadata. |

`BR-PROJ-01..03` do not introduce persisted domain entities; they constrain downstream technology, hosting, repository security, and CI decisions.

## 1. Entities and Fields

### 1.1 User
Represents an individual user in the system.
- `id` (UUID, Primary Key, Foreign Key -> managed authentication user ID)
- `email` (String, Unique) - Cached verified identity email; identity provider records remain owned by the authentication service.
- `interests` (Array of Strings)
- `language_preferences` (Array of Strings)
- `created_at` (Timestamp)
- `updated_at` (Timestamp)

### 1.2 DeliveryChannel
Represents the communication channels a user has connected.
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key -> User.id)
- `type` (Enum: `in-app`, `email`, `telegram`, `slack`, `webhook`)
- `status` (Enum: `pending`, `active`, `disabled`)
- `config` (JSON) - Stores channel-specific configuration (e.g., Slack webhook URL, Telegram chat ID, verified email address, or outbound webhook URL and signing secret). *Note: Must be encrypted at rest.*
- `verified_at` (Timestamp, Nullable)
- `consecutive_failure_count` (Integer, Default: 0) - Reset after a successful delivery; disables the channel at 5.
- `last_error_code` (String, Nullable) - Sanitized; no remote response body.
- `created_at` (Timestamp)
- `updated_at` (Timestamp)

### 1.3 GlobalSource
Represents a unique news source (RSS, Atom, or Web URL). Cached globally to avoid redundant fetching.
- `id` (UUID, Primary Key)
- `url` (String, Unique)
- `type` (Enum: `rss`, `atom`, `web`)
- `status` (Enum: `active`, `paused`) - Transitions to paused if failed 5 times.
- `failed_fetch_count` (Integer) - Tracks consecutive failures.
- `last_fetched_at` (Timestamp)
- `created_at` (Timestamp)

### 1.4 ProcessingFlow
Represents an automated rule/flow configured by a user. Max 5 per user.
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key -> User.id)
- `name` (String)
- `frequency` (Enum: `daily`)
- `ai_model` (Enum: `gpt-5.4-mini`)
- `prompt_type` (Enum: `predefined`, `custom`)
- `prompt_template` (Text) - Encrypted if custom.
- `is_enabled` (Boolean, Default: true)
- `next_run_at` (Timestamp) - Initialized to the next 06:00 UTC processing window.
- `last_run_at` (Timestamp, Nullable)
- `created_at` (Timestamp)
- `updated_at` (Timestamp)

### 1.5 FlowSource (Join Table)
Maps a processing flow to one or more global sources.
- `flow_id` (UUID, Foreign Key -> ProcessingFlow.id)
- `source_id` (UUID, Foreign Key -> GlobalSource.id)

### 1.6 FlowDeliveryChannel (Join Table)
Maps a processing flow to one or more delivery channels.
- `flow_id` (UUID, Foreign Key -> ProcessingFlow.id)
- `channel_id` (UUID, Foreign Key -> DeliveryChannel.id)

### 1.7 IngestedArticle
Stores the raw extracted content from a GlobalSource. Used by all flows that subscribe to the source.
- `id` (UUID, Primary Key)
- `source_id` (UUID, Foreign Key -> GlobalSource.id)
- `external_guid` (String, Nullable) - Unique identifier from the feed (e.g. RSS `<guid>` or Atom `<id>`).
- `title` (String)
- `url` (String)
- `content` (Text) - Main text extracted from the URL, stripped of ads/menus.
- `published_at` (Timestamp, Nullable)
- `created_at` (Timestamp)
- *Uniqueness rules:* Within one source, a non-null external GUID identifies an article. When no GUID exists, the URL identifies it. The technology layer must enforce both conditional rules atomically while allowing distinct GUID-bearing feed items to reuse a URL.

### 1.8 SourceItemFingerprint
Stores content-free identifiers after article rows are purged so old feed entries are not ingested again.
- `id` (UUID, Primary Key)
- `source_id` (UUID, Foreign Key -> GlobalSource.id ON DELETE CASCADE)
- `guid_hash` (String, Nullable)
- `url_hash` (String)
- `first_seen_at` (Timestamp)
- *Uniqueness rules:* Within one source, non-null GUID hashes are unique. URL hashes are unique for fingerprint rows without a GUID. The selected relational technology must enforce these conditional rules.
- Fingerprints are retained for the lifetime of the source because they contain only one-way identifiers, not article content. The application-level cross-partition check in section 3 also applies here.

### 1.9 SourceFetchRun
Provides one durable, idempotent fetch result for a source in a daily cycle.
- `id` (UUID, Primary Key)
- `source_id` (UUID, Foreign Key -> GlobalSource.id ON DELETE CASCADE)
- `cycle_date` (Date) - UTC processing date.
- `status` (Enum: `pending`, `processing`, `completed`, `failed`)
- `error_code` (String, Nullable) - Sanitized; must not contain fetched content.
- `started_at` (Timestamp, Nullable)
- `completed_at` (Timestamp, Nullable)
- `created_at` (Timestamp)
- *Constraint:* Unique composite index on `(source_id, cycle_date)`.

### 1.10 ProcessingRun
Tracks the outcome and retry state of one flow in one daily cycle.
- `id` (UUID, Primary Key)
- `flow_id` (UUID, Foreign Key -> ProcessingFlow.id ON DELETE CASCADE)
- `cycle_date` (Date) - UTC processing date.
- `status` (Enum: `pending`, `processing`, `completed`, `no_content`, `failed`)
- `error_code` (String, Nullable) - Sanitized and operator-visible.
- `started_at` (Timestamp, Nullable)
- `completed_at` (Timestamp, Nullable)
- `created_at` (Timestamp)
- *Constraint:* Unique composite index on `(flow_id, cycle_date)`.

### 1.11 ProcessedDigest
Stores the final processed content generated by the AI for a specific flow. Retained for 1 week.
- `id` (UUID, Primary Key)
- `flow_id` (UUID, Foreign Key -> ProcessingFlow.id)
- `processing_run_id` (UUID, Unique, Foreign Key -> ProcessingRun.id ON DELETE CASCADE)
- `content` (JSON) - Validated structured digest containing `title`, `language`, and ordered sections/items with summaries and source URLs. Channel adapters render this structure safely.
- `token_usage` (Integer) - Tracks AI tokens consumed.
- `provider_request_id` (String, Nullable)
- `model` (String)
- `user_feedback` (Enum: `thumbs_up`, `thumbs_down`, `none`)
- `created_at` (Timestamp) - Used by cleanup jobs for 7-day retention deletion.

### 1.12 FlowArticle (Join Table)
Records that an article has been claimed or consumed by a flow, preventing the same retained article from appearing in multiple daily digests for that flow.
- `flow_id` (UUID, Foreign Key -> ProcessingFlow.id ON DELETE CASCADE)
- `article_id` (UUID, Foreign Key -> IngestedArticle.id ON DELETE CASCADE)
- `processing_run_id` (UUID, Foreign Key -> ProcessingRun.id ON DELETE CASCADE)
- `digest_id` (UUID, Nullable, Foreign Key -> ProcessedDigest.id ON DELETE SET NULL)
- `status` (Enum: `claimed`, `included`, `filtered`)
- `claimed_at` (Timestamp)
- *Constraint:* Unique composite index on `(flow_id, article_id)`.
- *Retry rule:* A retry of the same `ProcessingRun` reuses its claimed rows. If a run is terminally failed without a digest, its claims are deleted transactionally so the articles are eligible for the next daily run.

### 1.13 DigestDeliveryAttempt
Tracks the delivery state and history for each delivery channel associated with a digest. Enforces idempotent delivery.
- `id` (UUID, Primary Key)
- `digest_id` (UUID, Foreign Key -> ProcessedDigest.id ON DELETE CASCADE)
- `channel_id` (UUID, Nullable, Foreign Key -> DeliveryChannel.id ON DELETE SET NULL)
- `status` (Enum: `pending`, `sending`, `delivered`, `failed`)
- `error_message` (Text, Nullable) - Details of the failure, if any.
- `attempted_at` (Timestamp, Nullable)
- `locked_at` (Timestamp, Nullable) - Timestamp when status was set to `sending`, enabling crash-recovery checks.
- `retry_count` (Integer, Default: 0) - Tracks the number of retries for exponential backoff.
- `next_attempt_at` (Timestamp, Nullable) - Timestamp when the attempt is next eligible for retry after backoff delay.
- `created_at` (Timestamp)
- *Constraint:* Unique composite index on `(digest_id, channel_id)` to prevent duplicate rows in the database.
- *Idempotency & Delivery Protocol:* To satisfy the best-effort idempotent delivery NFR for channels that lack native API-level deduplication (such as Slack Webhooks, the Telegram Bot API, transactional email APIs, and user webhooks), the worker uses this logical pre-flight claim protocol:
  1. Before the external call, atomically claim an eligible `pending` or retryable `failed` attempt and transition it to `sending` with the current lease timestamp. Concurrent workers must not both succeed in claiming the same row.
  2. To prevent messages from being permanently lost if a worker crashes *before* initiating the external request, the scheduler runs a recovery sweep. Any attempt in `sending` status with `locked_at` older than a lock lease timeout (e.g., 5 minutes) is considered safely recoverable and reset back to `pending` for retry. To prevent this recovery sweep from racing active slow deliveries, every delivery HTTP request must have a maximum 30-second timeout, guaranteeing a worker never holds the lock longer unless it has crashed.
  3. If a crash occurs *after* the external API accepts the message but *before* the success transaction is committed, a retry may result in a duplicate. Since these external channels do not provide deduplication, this at-least-once transmission is a known technical limitation, mitigated by minimizing the time window between the API response and the status commit.

### 1.14 OperationalEvent
Stores sanitized failures and alert state that must remain visible after short-lived platform logs expire.
- `id` (UUID, Primary Key)
- `severity` (Enum: `warning`, `critical`)
- `category` (String, e.g. `dead_letter`, `cleanup_failed`, `provider_quota`, `database_unavailable`)
- `deduplication_key` (String)
- `context` (JSON) - IDs, status codes, and counts only; no article, digest, prompt, or secret content.
- `occurrence_count` (Integer, Default: 1)
- `first_seen_at` (Timestamp)
- `last_seen_at` (Timestamp)
- `alerted_at` (Timestamp, Nullable)
- `resolved_at` (Timestamp, Nullable)
- *Constraint:* At most one unresolved row per `deduplication_key`.

### 1.15 IntegrationCircuit
Stores a lightweight shared circuit breaker for an external provider or origin so independent workers do not amplify an outage.
- `id` (UUID, Primary Key)
- `scope_type` (Enum: `ai_provider`, `email_provider`, `telegram`, `slack`, `webhook_origin`)
- `scope_key` (String) - Provider identifier or one-way origin hash; never a credential or plaintext private URL.
- `state` (Enum: `closed`, `open`, `half_open`)
- `consecutive_failure_count` (Integer, Default: 0)
- `opened_at` (Timestamp, Nullable)
- `next_probe_at` (Timestamp, Nullable)
- `updated_at` (Timestamp)
- *Constraint:* Unique composite key on `(scope_type, scope_key)`.
- A successful call closes/resets the circuit. Classified transient failures increment it; reaching the adapter threshold opens it until `next_probe_at`. Only one worker may claim the half-open probe.

## 2. Relationships Overview
- **User** 1 : M **DeliveryChannel**
- **User** 1 : M **ProcessingFlow** (Max 5)
- **ProcessingFlow** M : N **GlobalSource** (via FlowSource)
- **ProcessingFlow** M : N **DeliveryChannel** (via FlowDeliveryChannel)
- **GlobalSource** 1 : M **IngestedArticle**
- **GlobalSource** 1 : M **SourceItemFingerprint**
- **GlobalSource** 1 : M **SourceFetchRun**
- **ProcessingFlow** 1 : M **ProcessedDigest**
- **ProcessingFlow** 1 : M **ProcessingRun**
- **ProcessingRun** 1 : 0..1 **ProcessedDigest**
- **ProcessedDigest** 1 : M **DigestDeliveryAttempt**
- **ProcessingFlow** M : N **IngestedArticle** (via FlowArticle)
- **DeliveryChannel** 1 : M **DigestDeliveryAttempt**

## 3. Storage Constraints & Policies
- **Data Isolation:** User's custom prompts and config JSON must be securely isolated and encrypted.
- **Data Retention:** `IngestedArticle` records, `ProcessedDigest` records, and their corresponding `DigestDeliveryAttempt` records must be physically deleted 7 days after `created_at` (subject to an operational cleanup schedule lag of up to 1 hour).
- **Global Caching:** `GlobalSource` records are shared entities. Their `url` must be unique to ensure fetch logic operates on a single record.
- **URL Canonicalization:** Before uniqueness checks, lowercase the scheme and host, convert internationalized hosts to ASCII, remove fragments and default ports, resolve dot segments, and preserve path/query semantics. Redirect targets are validated separately and do not silently replace the user-configured source URL.
- **Outbound Webhook Configuration:** Production webhook URLs must use HTTPS and must pass the same public-address SSRF validation as source URLs. Generate a distinct 32-byte signing secret for every webhook channel, encrypt it with the channel config, and reveal it only once when the channel is created or rotated. Custom authorization headers are not supported in the initial release.
- **Feed Parser Deduplication Safeguard:** Skip feed items with a publication timestamp older than seven days. For accepted items, transactionally insert both `IngestedArticle` and `SourceItemFingerprint`; a fingerprint conflict means the item was already seen. Items without timestamps still remain deduplicated after article retention deletion because fingerprints live until their source is deleted. No fixed feed-length assumption is used.
- **Deduplication Partition Cross-Check:** To handle feeds that inconsistently add or remove GUIDs, compare URL hashes against same-source article/fingerprint records when either the incoming or existing item lacks a GUID. If both items have GUIDs, GUID identity is authoritative; a shared URL with different GUIDs may represent distinct podcast episodes or updates and must not be collapsed.
- **Cache & Queue Content:** Cached user news content must expire within 24 hours. Durable queue messages contain record IDs and operational metadata only, never article text, digest text, custom prompts, or delivery credentials. Queue messages are deleted or archived after completion; archived/dead-letter metadata must not be sufficient to reconstruct content removed by the seven-day purge.
- **Operational Metadata:** Resolved `OperationalEvent` rows and `closed` `IntegrationCircuit` rows not updated for 30 days are deleted. They must contain only sanitized identifiers and counters, so they do not extend the retention of news or user-generated content.
- **Run Metadata:** `SourceFetchRun` and `ProcessingRun` rows older than 30 days are deleted after any related seven-day content has already been removed. Their error fields are sanitized codes, not provider responses or content.

## 4. Downstream Contract

The application layer must preserve decisions `D-01..D-06`: it must provide ownership enforcement, source-cycle and flow-cycle idempotency, transactional article claims, durable delivery attempts, retention jobs, and sanitized operational visibility. Concrete storage, queue, and encryption products are selected only in the technology layer.
