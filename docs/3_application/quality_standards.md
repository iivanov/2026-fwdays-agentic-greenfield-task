# Application Quality Standards

This document defines the engineering quality standards, testing strategies, and best practices to ensure the AI-Powered Personalized News Aggregator remains reliable, secure, and maintainable.

## 1. Code Quality & Style
- **Consistency:** All code must adhere to the standard style guides of the chosen language/framework (e.g., Prettier/ESLint for JavaScript/TypeScript, PEP8/Ruff for Python, or Go fmt).
- **Code Reviews:** All changes must be peer-reviewed via Pull Requests (PRs). No direct commits to the `main` branch.
- **Documentation:** Complex business logic, especially within the AI Processing Engine and source extraction heuristics, must be well-documented with inline comments.

## 2. Testing Strategy
- **Unit Testing:** All core utility functions, data transformations, and token estimation logic must have comprehensive unit tests.
- **Integration Testing:** 
  - API endpoints must have tests covering expected inputs, edge cases, and rate limit enforcement.
  - Background worker pipelines (Ingestion, Processing, Delivery) must be tested against mocked external services (mock RSS feeds, mock OpenAI API, mock Slack/Telegram).
- **Test Coverage:** The system should maintain a minimum of 80% test coverage across the backend codebase.

## 3. Continuous Integration / Continuous Deployment (CI/CD)
- **Automated Checks:** Every PR must pass automated CI pipelines which include:
  - Linting and code formatting checks.
  - Successful execution of the full test suite.
  - Static Code Analysis (e.g., SonarQube, Snyk) for security vulnerabilities.
- **Deployment:** Deployments should be fully automated, with the ability to rollback seamlessly if health checks fail post-deployment.

## 4. Error Handling & Logging
- **Structured Logging:** All services must use structured JSON logging to facilitate searching and monitoring (e.g., in ELK stack or Datadog).
- **Contextual Logs:** Log entries for workers must include relevant context: `user_id`, `flow_id`, `source_id`, and `trace_id` to trace a digest from ingestion to delivery.
- **Graceful Degradation:** The system must handle external API failures gracefully (e.g., OpenAI downtime) by retrying with exponential backoff rather than crashing or dropping tasks.
- **Alerting:** Critical errors, such as continuous database connection failures or sudden spikes in external API errors (e.g., 429 Too Many Requests), must trigger immediate alerts to the engineering team.

## 5. Security & Privacy Standards
- **Secret Management:** Credentials, API keys, and OAuth secrets must never be hardcoded or checked into version control. They must be managed via a secure secrets manager or environment variables.
- **Data Encryption:** User configurations containing sensitive data (e.g., Slack Webhooks, custom prompts) must be encrypted at rest in the database.
- **Input Validation & Sanitization:** All user inputs (especially custom prompts and URL sources) must be strictly validated and sanitized to prevent injection attacks (e.g., Prompt Injection, XSS, SSRF).
- **Least Privilege:** Background workers should run with the minimum database permissions required to perform their specific tasks.

## 6. Performance & Reliability
- **Caching Policies:** The global source cache must be strictly enforced to avoid redundant network calls and IP bans.
- **Resource Constraints:** The AI Processing Engine must strictly enforce truncation limits before sending payloads to the `gpt-5.4-mini` model to prevent exceeding context windows and manage costs.
- **Idempotency (Best-Effort):** Delivery mechanisms must implement best-effort idempotency. For channels lacking native deduplication APIs (including Slack, Telegram, and standard SMTP), double-delivery must be minimized using database-level pre-flight state locking, and at-least-once delivery is acceptable. For channels with native deduplication, strict idempotency must be enforced.
- **Dead Letter Queues (DLQ):** Messages in the background processing queues that fail repeatedly after max retries must be moved to a DLQ for manual inspection, ensuring the main queues are not blocked.
