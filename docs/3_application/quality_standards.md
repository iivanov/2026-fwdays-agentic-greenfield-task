# Application Quality Standards

This document defines the engineering quality standards, testing strategies, and best practices to ensure the AI-Powered Personalized News Aggregator remains reliable, secure, and maintainable.

## 0. Upstream Decision Basis

| Quality decision | Inputs | Required evidence |
| --- | --- | --- |
| **Q-01 — Automated correctness** | `NFR-REL-01..05`, `A-02..A-05` | Unit, integration, concurrency, retry, and idempotency tests. |
| **Q-02 — Security verification** | `NFR-SEC-01..06`, `A-06` | Authorization, encryption, input validation, SSRF, signing, and secret-leak tests. |
| **Q-03 — Operability** | `NFR-OPS-01..04`, `A-07` | Structured-log checks, persistent failure tests, quota monitoring, and rollback smoke tests. |
| **Q-04 — Responsive UX** | `NFR-PERF-02`, `NFR-UX-01`, `A-01` | Responsive browser tests and proof that slow work is outside request/response paths. |
| **Q-05 — Public repository safety** | `BR-PROJ-02..03`, `NFR-CON-07..08`, `NFR-SEC-03` | Static analysis, dependency review, secret scanning, pinned automation, and protected-branch evidence. |

## 1. Code Quality & Style
- **Consistency:** All code must pass the formatter, linter, and type checker selected in the technology documentation.
- **Code Reviews:** All changes must be peer-reviewed via Pull Requests (PRs). No direct commits to the `main` branch.
- **Documentation:** Complex business logic, especially within the AI Processing Engine and source extraction heuristics, must be well-documented with inline comments.

## 2. Testing Strategy
- **Unit Testing:** All core utility functions, data transformations, and token estimation logic must have comprehensive unit tests.
- **Integration Testing:** 
  - API endpoints must have tests covering expected inputs, edge cases, and rate limit enforcement.
  - Background worker pipelines (Ingestion, Processing, Delivery) must be tested against mocked external services (mock RSS feeds, mock OpenAI API, mock Slack/Telegram/webhook receivers).
- **Test Coverage:** The system should maintain a minimum of 80% test coverage across the backend codebase.

## 3. Continuous Integration / Continuous Deployment (CI/CD)
- **Automated Checks:** Every PR must pass automated CI pipelines which include:
  - Language/runtime-appropriate linting with zero warnings.
  - Strict static type analysis independent of bundling/transpilation.
  - Deterministic formatting verification.
  - Successful execution of the full test suite.
  - Security-focused static application and automation-workflow analysis.
  - Dependency review blocking newly introduced high/critical vulnerabilities and disallowed licenses.
  - Workflow syntax/expression validation.
  - Database migration lint/validation against the local database stack.
  - Declarative infrastructure formatting/validation plus read-only drift/audit checks.
- **Deployment:** Deployments should be fully automated, with the ability to rollback seamlessly if health checks fail post-deployment.

### 3.1 Repository security gates

- Enable automated dependency vulnerability alerts plus scheduled version/security update pull requests.
- Enable secret scanning and push protection for the public repository.
- Pin third-party CI actions to immutable revisions and update them through reviewed automation.
- Configure protected-branch rules so lint, typecheck, tests, dependency review, workflow lint, and SAST must pass before merge.
- Treat high/critical SAST and dependency findings as merge blockers. Lower-severity findings require an explicit documented disposition rather than silent dismissal.

## 4. Error Handling & Logging
- **Structured Logging:** All services must use structured JSON logging compatible with the selected hosting platform's log search.
- **Contextual Logs:** Log entries for workers must include relevant context: `user_id`, `flow_id`, `source_id`, and `trace_id` to trace a digest from ingestion to delivery.
- **Graceful Degradation:** The system must handle external API failures gracefully (e.g., OpenAI downtime) by retrying with exponential backoff rather than crashing or dropping tasks.
- **Alerting:** Critical errors, such as continuous database connection failures or sudden spikes in external API errors (e.g., 429 Too Many Requests), must trigger immediate alerts to the engineering team.

## 5. Security & Privacy Standards
- **Secret Management:** Credentials, API keys, and OAuth secrets must never be hardcoded or checked into version control. They must be managed via a secure secrets manager or environment variables.
- **Data Encryption:** User configurations containing sensitive data (e.g., Slack webhooks, outbound webhook URLs/signing secrets, custom prompts) must be encrypted at rest in the database.
- **Input Validation & Sanitization:** All user inputs (especially custom prompts and URL sources) must be strictly validated and sanitized to prevent injection attacks (e.g., Prompt Injection, XSS, SSRF).
- **Least Privilege:** Background workers should run with the minimum database permissions required to perform their specific tasks.

## 6. Performance & Reliability
- **Caching Policies:** The global source cache must be strictly enforced to avoid redundant network calls and IP bans.
- **Resource Constraints:** The AI Processing Engine must strictly enforce truncation limits before sending payloads to the selected model to prevent exceeding context windows and manage costs.
- **Idempotency (Best-Effort):** Delivery mechanisms must implement best-effort idempotency. For channels lacking native deduplication APIs (including Slack, Telegram, transactional email APIs, and user webhooks), double-delivery must be minimized using database-level pre-flight state locking, and at-least-once delivery is acceptable. Webhooks expose a stable event ID for receiver-side deduplication. For channels with native deduplication, strict idempotency must be enforced.
- **Dead Letter Queues (DLQ):** Messages in the background processing queues that fail repeatedly after max retries must be moved to a DLQ for manual inspection, ensuring the main queues are not blocked.
