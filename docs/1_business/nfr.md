# Non-Functional Requirements

## 1. Performance and scalability

- **NFR-PERF-01 — Shared source work:** Fetch each source at most once per update cycle across all users.
- **NFR-PERF-02 — Responsive UI:** Ingestion, AI processing, delivery, retries, and cleanup execute outside interactive browser requests.
- **NFR-PERF-03 — AI payload control:** Enforce deterministic per-article, per-batch, and output limits before calling the AI API.
- **NFR-PERF-04 — External rate limits:** Bound concurrency and respect rate-limit responses from providers and user-configured webhook origins.

## 2. Reliability

- **NFR-REL-01 — Durable work:** Background work survives runtime restarts and is acknowledged only after durable state commits.
- **NFR-REL-02 — Retry:** Retry transient external failures with bounded exponential backoff; exhausted work becomes operator-visible.
- **NFR-REL-03 — Source health:** Pause a source after five consecutive failed fetch cycles.
- **NFR-REL-04 — Delivery semantics:** Delivery is best-effort at-least-once where a receiver lacks native idempotency. Database state minimizes duplicates, and generic webhooks include a stable event ID for receiver deduplication.
- **NFR-REL-05 — Timeouts and recovery:** External calls use bounded timeouts and abandoned processing leases are recoverable.

## 3. Security and privacy

- **NFR-SEC-01 — Production authentication:** Production permits Google and GitHub OAuth only.
- **NFR-SEC-02 — Authorization:** User-owned data is deny-by-default and isolated between users.
- **NFR-SEC-03 — Secret protection:** OAuth tokens, delivery credentials, webhook URLs/signing secrets, and custom prompts are encrypted at rest and excluded from logs.
- **NFR-SEC-04 — Email anti-abuse:** Email delivery is restricted to the authenticated user's verified email.
- **NFR-SEC-05 — SSRF defense:** User-provided source and webhook URLs cannot reach loopback, private, link-local, multicast, reserved, or cloud metadata addresses; redirects are revalidated.
- **NFR-SEC-06 — Signed webhooks:** Generic webhook bodies are integrity-protected and authenticated with a per-channel signing secret.

## 4. Product and operational constraints

- **NFR-CON-01 — Flow limit:** Enforce at most five flows per user.
- **NFR-CON-02 — Execution frequency:** A flow runs at most once per UTC day.
- **NFR-CON-03 — Model restriction:** AI processing uses only `gpt-5.4-mini` in the initial release.
- **NFR-CON-04 — Hosting cost:** Initial infrastructure hosting must remain $0/month within documented free-tier quotas. Usage-billed OpenAI calls and an optional custom domain are outside this hosting-cost boundary.
- **NFR-CON-05 — Setup simplicity:** Prefer the fewest managed services and no continuously administered server for the initial release.
- **NFR-CON-06 — Free-tier failure:** The system must not enable paid overage automatically; it queues/rejects work and alerts the operator when a free allowance is exhausted.
- **NFR-CON-07 — Public/non-commercial project:** Hosting and developer tooling may rely on benefits restricted to public repositories or personal/non-commercial use.
- **NFR-CON-08 — Tooling cost:** Prefer maintained open-source tools and no-cost GitHub public-repository security/CI features before introducing paid tooling.

## 5. Data lifecycle

- **NFR-DATA-01 — Seven-day purge:** Permanently delete article content, digests, and delivery attempts seven days after creation, with at most one hour of cleanup lag.
- **NFR-DATA-02 — Cached content:** Cached user/news content expires within 24 hours.
- **NFR-DATA-03 — Queue minimization:** Queue payloads contain identifiers and operational metadata, never article bodies, digests, prompts, or credentials.

## 6. Maintainability and observability

- **NFR-OPS-01 — Structured logs:** API and worker logs are structured and correlated by request, job, flow, and source identifiers without sensitive content.
- **NFR-OPS-02 — Persistent failures:** Critical/exhausted failures remain operator-visible beyond short platform log retention.
- **NFR-OPS-03 — Usage monitoring:** Record AI token usage per flow/run and monitor hosting/provider quotas.
- **NFR-OPS-04 — Change safety:** Schema and runtime changes are tested and deployed through a rollback-capable CI/CD process.

## 7. Usability

- **NFR-UX-01 — Responsive dashboard:** The browser application supports desktop, tablet, and mobile layouts.
