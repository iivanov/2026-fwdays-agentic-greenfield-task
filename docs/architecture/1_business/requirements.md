# Product Requirements: AI-Powered Personalized News Aggregator

## 1. Product Goal

Provide a web application that gathers news from user-selected sources, applies personalized AI summarization, translation, and relevance rules, and delivers one digest through the user's chosen channels.

## 2. Functional Requirements

### 2.1 Users

- **BR-USER-01 — Authentication:** Users can sign up and sign in with Google or GitHub OAuth. Email/password authentication is available only for local development and is disabled in production.
- **BR-USER-02 — Profile:** Users can manage interests, language preferences, and connected delivery channels.
- **BR-USER-03 — Flow quota:** A user can own at most five processing flows.

### 2.2 Sources and ingestion

- **BR-SRC-01 — Source management:** Users can add, view, and remove sources assigned to their flows.
- **BR-SRC-02 — Feed sources:** RSS and Atom feeds are supported as automated multi-article sources.
- **BR-SRC-03 — Article sources:** A direct article URL can be added and ingested once. General website crawling and link discovery are outside the initial release.
- **BR-SRC-04 — Shared fetching:** A source used by multiple users is fetched once per update cycle and the result is shared across eligible flows.
- **BR-SRC-05 — Extraction:** Article pages are reduced to their main readable text; navigation, advertising, and footer content are excluded.
- **BR-SRC-06 — Source health:** After five consecutive failed fetch cycles, a source is paused and subscribed users see an in-app warning.

### 2.3 Processing flows

- **BR-FLOW-01 — Flow configuration:** Users can create, edit, enable, disable, and delete automated processing flows.
- **BR-FLOW-02 — Frequency:** Enabled flows run once daily. The initial release uses a common 06:00 UTC processing window and does not expose per-user delivery times.
- **BR-FLOW-03 — New content only:** An article is processed at most once by a given flow. A flow with no new articles records a `no_content` result and sends no digest.
- **BR-FLOW-04 — Aggregation:** New articles are batched and near-duplicate stories are grouped before AI processing.
- **BR-FLOW-05 — AI model:** The initial release uses `gpt-5.4-mini`; model selection is not exposed.
- **BR-FLOW-06 — Input control:** Article and batch input is truncated before AI processing to remain within cost and context limits.
- **BR-FLOW-07 — Prompts:** Users can choose a predefined prompt or provide a custom prompt for summarization, translation, and relevance filtering.
- **BR-FLOW-08 — Feedback:** Users can rate a digest thumbs-up or thumbs-down. The initial release stores and reports feedback but does not modify prompts automatically.

### 2.4 Delivery

- **BR-DEL-01 — In-app:** Persist the digest in the user's dashboard.
- **BR-DEL-02 — Email:** Send the digest only to the authenticated user's verified email address.
- **BR-DEL-03 — Telegram:** Send through the application-owned Telegram bot after the user links a chat.
- **BR-DEL-04 — Slack:** Send to a user-configured Slack incoming webhook.
- **BR-DEL-05 — Generic webhook:** POST the digest as versioned, signed JSON to a user-configured HTTPS endpoint.
- **BR-DEL-06 — Multiple outputs:** A flow can deliver one digest to one or more configured channels.

### 2.5 Retention

- **BR-DATA-01 — Content retention:** Ingested article content, generated digests, and delivery attempts are retained for seven days and permanently deleted with no more than one hour of cleanup lag.
- **BR-DATA-02 — Operational metadata:** Content-free identifiers and sanitized operational records may outlive content only when they cannot reconstruct deleted user/news content.

### 2.6 Project distribution and use

- **BR-PROJ-01 — Non-commercial use:** The initial release is a non-commercial educational/personal project; commercial operation is outside scope.
- **BR-PROJ-02 — Public repository:** Source code and project automation are maintained in a public GitHub repository. Secrets, production data, and generated private configuration must never be committed.
- **BR-PROJ-03 — Reusable tooling:** No-cost open-source tools and GitHub features available to public repositories may be used when they improve implementation quality, security, or delivery simplicity.

## 3. Explicit Initial-Release Exclusions

- General website crawling and automatic link discovery.
- User-selectable AI models.
- Per-user execution times or time zones.
- Automatic prompt adaptation from feedback.
- Arbitrary custom headers for generic webhook delivery.
- Commercial operation or paid-service guarantees.
