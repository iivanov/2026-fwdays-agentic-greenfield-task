# Application Architecture Tactics

These tactics refine the logical architecture using business, NFR, and data decisions. They state behaviors the technology layer must implement without naming products.

## 0. Upstream Decision Basis

| Tactic group | Inputs |
| --- | --- |
| Delivery and processing reliability | `NFR-REL-01..05`, `D-02..D-05`, `A-03..A-05` |
| Security and privacy | `NFR-SEC-01..06`, `NFR-DATA-01..03`, `D-01`, `D-04..D-05`, `A-06` |
| Operability and change safety | `NFR-OPS-01..04`, `BR-PROJ-02..03`, `A-07`, `Q-01..Q-05` |
| Cost and platform constraints | `NFR-CON-04..08`, `NFR-PERF-01..04` |

## 1. Required Tactics

### AT-01 — Infrastructure and configuration as code

- Keep database schema/policies/schedules, function configuration, frontend routing/headers, CI, static analysis, dependency automation, and repeatable repository settings in version control.
- Separate desired configuration from credentials and runtime data. Committed files contain secret names/placeholders only.
- Make provisioning/deployment commands idempotent and support a read-only plan/validation step before mutation.
- Document unavoidable one-time bootstrap actions and provide an audit command/checklist for settings that cannot be managed reliably as code.
- Detect drift before deployment where provider APIs/tooling permit it; never repair production drift silently from a developer machine.

**Verification:** A clean checkout plus documented credentials can recreate local infrastructure and deploy the application without undocumented dashboard edits. CI validates all declarative files.

### AT-02 — Transactional state transition and enqueue

- Commit domain state and its next durable work item atomically when they share a transactional store.
- If atomic enqueue is unavailable, use a transactional outbox and an idempotent dispatcher.
- Consumers acknowledge work only after their domain transaction commits.

**Verification:** Crash tests at every commit/enqueue boundary produce neither lost work nor duplicate domain records.

### AT-03 — Idempotency and concurrency control

- Give source cycles, flow cycles, and deliveries stable domain idempotency keys.
- Enforce uniqueness in durable storage and claim work with leases/atomic transitions.
- Make retries reuse the same run/attempt rather than creating parallel records.

**Verification:** Concurrent duplicate messages produce one source run, one flow run, and one attempt per digest/channel.

### AT-04 — Backpressure and bounded work

- Bound jobs per invocation, feed items per cycle, article text, AI batch/output size, fetch concurrency, and retry count.
- Persist excess work for later processing instead of expanding memory/concurrency without limit.
- Fail closed and alert when provider/free-tier capacity is exhausted.

**Verification:** Load tests remain within configured memory, CPU, duration, invocation, and provider-rate budgets.

### AT-05 — Failure isolation and graceful degradation

- Isolate ingestion, AI processing, and each delivery attempt so one source/channel cannot fail a complete cycle.
- Persist the in-app digest before external delivery. External channel failures never delete a valid digest or block other channels.
- Pause unhealthy sources/channels after their defined thresholds without globally stopping unrelated work.

**Verification:** Injected failures in every external adapter affect only the corresponding run/attempt and surface a visible status.

### AT-06 — Timeout, retry, circuit-breaker, and dead-letter policy

- Set explicit connection/request deadlines for every external call.
- Retry only classified transient errors with exponential backoff and jitter.
- Stop repeated calls to an unhealthy source/origin/provider for a cool-down period; use a half-open probe before resuming normal traffic.
- Dead-letter exhausted work with sanitized diagnostics and a documented replay procedure.

**Verification:** Adapter contract tests cover success, timeout, rate limit, permanent error, open/half-open circuit, retry exhaustion, and replay.

### AT-07 — Defense in depth

- Enforce ownership at both API and data boundaries.
- Validate and canonicalize input at entry; encode output for its destination.
- Apply SSRF checks immediately before outbound connections and on permitted redirects.
- Encrypt sensitive configurations, sign generic webhooks, minimize privileged credentials, and redact logs.

**Verification:** Authorization, injection, SSRF, redirect, DNS-rebinding, encryption, signature, and log-redaction tests pass.

### AT-08 — Data minimization and deletion by design

- Keep content in durable domain records rather than queue/log payloads.
- Attach lifecycle timestamps at creation and make deletion safe to rerun.
- Retain only non-reconstructive fingerprints/operational metadata beyond content retention.

**Verification:** Seeded expired data disappears within the cleanup SLA from domain, cache, queue, and log-controlled storage.

### AT-09 — Ports and adapters

- Domain processing depends on source, AI, delivery, queue, clock, and encryption interfaces—not provider SDKs directly.
- Provider-specific request/response translation and error classification live in adapters.
- Contract tests are reusable across adapter implementations.

**Verification:** A fake adapter runs the complete pipeline, and replacing one provider does not alter domain entities or orchestration rules.

### AT-10 — Correlated observability

- Propagate request, job, cycle, flow, source, digest, and delivery-attempt IDs through structured logs and operational events.
- Record duration, outcome, retry count, and provider request IDs without content or secrets.
- Alert once per deduplication key and explicitly resolve recovered events.

**Verification:** An operator can trace one digest from schedule to every delivery attempt using identifiers only.

### AT-11 — Evolutionary schema and deployment

- Use forward-only, reviewed migrations and expand/migrate/contract changes across separate deployments.
- Keep runtime changes compatible with both old and new schema during the deployment window.
- Roll back code with immutable artifacts; correct schema with tested compensating migrations.

**Verification:** Migration tests cover upgrade from the previous release and mixed-version execution during the compatibility window.

### AT-12 — Cost guardrails

- Treat article counts, AI input/output, worker invocations, database size, email sends, and provider errors as measurable budgets.
- Alert below hard free-tier limits and never opt into automatic paid overage.
- Define exit thresholds before capacity is exhausted.

**Verification:** Quota tests prove the system queues/rejects safely and emits one actionable operational event.

## 2. Downstream Contract

The technology trade-off analysis must map concrete tools to `AT-01..AT-12`. A tactic may be deferred only by changing its upstream requirement or recording an explicit accepted risk; omission is not a technology decision.
