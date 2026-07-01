# Non-Functional Requirements (NFRs)

This document outlines the technical constraints, system qualities, and operational requirements for the AI-Powered Personalized News Aggregator.

## 1. Performance & Scalability
* **Global Caching:** The system must implement shared resource caching for ingested feeds and web pages. If multiple users subscribe to the same source, the system must fetch the source only once per update cycle to minimize redundant network requests and prevent IP bans.
* **Asynchronous Processing:** Data ingestion, AI processing, and content delivery must be executed asynchronously via background jobs/queues to guarantee the web UI remains responsive.
* **Payload & Token Optimization:** The system must implement intelligent truncation and token estimation strategies to ensure batched payloads stay strictly within the context window limits of the AI model.
* **API Rate Limiting:** The system must proactively manage and respect the rate limits of external APIs (e.g., OpenAI, Telegram, Slack).

## 2. Reliability & Fault Tolerance
* **Dead Feed Management:** The system must track the health of data sources. If a source fails to fetch 5 consecutive times, it must automatically pause the feed and notify the user.
* **Retry Mechanisms:** Transient failures in external service calls (AI processing, delivery channels) must be handled using exponential backoff and retry logic.
* **Idempotent Delivery:** The delivery pipeline must be idempotent to ensure users do not receive duplicate news digests if a delivery job is retried.

## 3. Security & Privacy
* **Production Authentication:** Production authentication must strictly rely on secure OAuth providers (Google, GitHub). Email/password login is explicitly disabled in production environments.
* **Anti-Spam / Delivery Restrictions:** To prevent the system from being used as a spam relay, email delivery is strictly restricted to the user's own verified email address.
* **Data Isolation:** User data, custom prompt instructions, and personalized flow configurations must be securely isolated.
* **Secret Management:** Sensitive data, such as OAuth tokens and third-party delivery credentials (e.g., Slack webhooks, Telegram tokens), must be securely encrypted at rest.

## 4. System Constraints & Quotas
* **Flow Limits:** The system must enforce a hard limit of **5 processing flows** per user.
* **Execution Frequency:** Flow execution is currently restricted to a maximum of **once per day** (every 24 hours).
* **Model Restriction:** AI processing is strictly constrained to the **`gpt-5.4-mini`** model to control operational costs and ensure predictable performance.

## 5. Data Retention & Lifecycle
* **Automated Data Purge:** All processed news data and generated digests must be automatically and permanently deleted exactly **1 week (7 days)** after creation.

## 6. Maintainability & Observability
* **System Logging:** The system must implement structured logging, particularly for the background processing and AI integration pipelines, to trace processing failures or skipped sources.
* **Cost & Usage Monitoring:** The system must monitor and log AI token usage per user/flow to analyze costs and prevent abuse.

## 7. Usability
* **Responsive Design:** The web application dashboard must be fully responsive, functioning seamlessly across desktop, tablet, and mobile devices.
