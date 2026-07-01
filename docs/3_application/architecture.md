# Application Architecture

## 1. High-Level Architecture Overview

The AI-Powered Personalized News Aggregator is designed as a distributed, asynchronous system. It comprises a user-facing Web Application for configuration, a centralized API Server for data management, and a series of background worker services (Ingestion, AI Processing, Delivery) that handle the heavy processing asynchronously via message queues.

## 2. Core Components

### 2.1 Web Application (Frontend)
- **Responsibility:** Provides the dashboard for users to authenticate, manage their profiles, configure their news sources, and set up processing flows and delivery channels.
- **Key Features:** Fully responsive design, OAuth login flow, real-time feedback on flow statuses.

### 2.2 API Server (Backend)
- **Responsibility:** Acts as the central hub for the Web Application. Handles business logic, database interactions, and acts as the gateway to the system.
- **Key Features:** 
  - OAuth 2.0 authentication integration (Google, GitHub).
  - CRUD operations for `User`, `GlobalSource`, `ProcessingFlow`, and `DeliveryChannel` entities.
  - Rate limiting and quota enforcement (e.g., max 5 flows per user).

### 2.3 Data Storage & Caching
- **Primary Database:** Relational database (e.g., PostgreSQL) to store system entities with strict relationships and ACID guarantees.
- **Cache / Message Broker:** In-memory datastore (e.g., Redis) used for two primary purposes:
  - **Message Queues:** Facilitating asynchronous communication between the API Server and background workers.
  - **Shared Resource Caching:** Temporarily caching fetched source data to ensure a source is only fetched once per update cycle across all users.

### 2.4 Background Worker Services
To ensure the web UI remains responsive and external API limits are respected, heavy processing is offloaded to independent, asynchronous background workers.

#### 2.4.1 Ingestion Service
- **Responsibility:** Periodically fetches data from `GlobalSource` URLs (RSS, Atom, Web).
- **Key Features:**
  - Extracts main article text and strips ads/menus (e.g., using Readability).
  - Implements shared caching to prevent redundant network requests and IP bans.
  - Tracks failed fetches and pauses sources after 5 consecutive failures.
  - Persists raw data into the `IngestedArticle` table.

#### 2.4.2 AI Processing Engine
- **Responsibility:** Processes batched `IngestedArticle` data using the configured AI model (`gpt-5.4-mini`).
- **Key Features:**
  - Performs smart deduplication of similar stories before AI processing.
  - Implements intelligent token estimation and truncation to fit within the AI context window.
  - Applies user-defined custom prompts or predefined templates for summarization, translation, and filtering.
  - Handles transient failures with external AI APIs using exponential backoff.
  - Persists the final output as a `ProcessedDigest`.

#### 2.4.3 Delivery Service
- **Responsibility:** Dispatches `ProcessedDigest` content to the user's configured `DeliveryChannel`.
- **Key Features:**
  - Supports multiple delivery integrations: In-App, Email (restricted to user's verified address), Telegram, Slack.
  - Implements best-effort idempotent delivery to minimize duplicate messages during retries.
  - Respects external API rate limits for each respective delivery platform.

## 3. Data Flow

1. **Configuration:** The user configures a `ProcessingFlow` via the Web Application. The API Server saves this to the Database and schedules the flow (e.g., daily).
2. **Ingestion Trigger:** A cron job or scheduler triggers the Ingestion Service to fetch new articles for all `GlobalSource` records required by active flows.
3. **Extraction & Storage:** The Ingestion Service extracts the article content and saves it as `IngestedArticle` records. An event is published to the AI Processing Queue.
4. **AI Processing:** The AI Processing Engine picks up the event, batches the new `IngestedArticle` records, applies truncation and deduplication, and sends the payload to the AI model (`gpt-5.4-mini`).
5. **Digest Creation:** The AI response is saved as a `ProcessedDigest`. An event is published to the Delivery Queue.
6. **Delivery:** The Delivery Service picks up the event, decrypts the necessary channel credentials, and pushes the digest to the configured external platforms (Slack, Telegram, Email).

## 4. Security & Data Management
- **Secret Encryption:** All sensitive data (Slack webhooks, Telegram tokens, OAuth tokens, custom prompt templates) must be encrypted at rest in the database.
- **Data Lifecycle Management:** A cleanup worker runs every 30 minutes to automatically and permanently delete all `IngestedArticle`, `ProcessedDigest`, and `DigestDeliveryAttempt` records older than 7 days, maintaining a retention window of 7 days with a maximum cleanup lag of 1 hour (leaving 30 minutes of operational headroom for query runtime and scheduling jitter). To prevent re-ingesting purged articles whose database metadata has been deleted, the Ingestion Service must explicitly skip feed items older than 7 days during polling. Additionally, all user-related news content cached in Redis must enforce a strict TTL (maximum 24 hours), and BullMQ background queues must be configured to automatically evict completed or failed jobs and payloads (`removeOnComplete: true` and `removeOnFail: { age: 86400 }`) to prevent expired data from persisting in memory or Redis AOF logs.
- **Data Isolation:** The database design and API access control ensure strict data isolation between tenants (users).
