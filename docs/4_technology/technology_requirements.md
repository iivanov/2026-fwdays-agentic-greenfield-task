# Technology Trade-off Analysis and Decisions

Technology is selected only after evaluating the upstream business, data, application, and quality decisions. Hosting details in [`hosting.md`](hosting.md) realize the decisions made here; hosting does not independently redefine the stack.

## 0. Upstream Inputs

| Input group | Decisions that constrain technology |
| --- | --- |
| Product scope | `BR-USER-*`, `BR-SRC-*`, `BR-FLOW-*`, `BR-DEL-*`, `BR-DATA-*` |
| System qualities | `NFR-PERF-*`, `NFR-REL-*`, `NFR-SEC-*`, `NFR-DATA-*`, `NFR-OPS-*`, `NFR-UX-01` |
| Hard operational constraints | `NFR-CON-01..08`, especially $0 hosting, non-commercial/public operation, and minimal managed services |
| Data contracts | `D-01..D-06` |
| Logical architecture and tactics | `A-01..A-07`, `AT-01..AT-12` |
| Quality evidence | `Q-01..Q-05` |

## 1. Decision Drivers

Alternatives are evaluated in this priority order:

1. **Correctness and security:** Must implement relational integrity, durable work, authorization, retention, encryption, SSRF defenses, and delivery semantics.
2. **Hard product constraints:** Must support the required sources, AI model, OAuth providers, and five output channel types.
3. **$0 infrastructure:** Must operate without paid hosting while within published free quotas; OpenAI usage is explicitly outside this boundary.
4. **Setup simplicity:** Prefer fewer provider accounts, no server administration, one primary language, and local production-like development.
5. **Initial-scale fit:** Daily workloads and a small user base matter more than maximum throughput.
6. **Migration path:** The design must expose boundaries where free-tier components can later be replaced.

No option that fails drivers 1–3 can win based on developer convenience.

## 2. Trade-off Analysis

### T-01 — Primary language and runtime

**Inputs:** `A-01`, `A-04`, `A-05`, `Q-01`, `NFR-CON-05`.

| Option | Strengths | Costs/risks | Fit |
| --- | --- | --- | --- |
| TypeScript across browser/API/workers | Shared types and validation; strong browser, feed, DOM, and provider SDK ecosystem; supported by managed edge runtimes | Edge runtime differs from Node.js; packages require compatibility tests | **Best** |
| TypeScript frontend + Python workers | Strong parsing/AI ecosystem | Two languages, contracts, toolchains, and deployment paths | Acceptable but unnecessarily complex |
| TypeScript frontend + Go backend | Efficient binaries and concurrency | More code, weaker reader-mode ecosystem, separate type contracts | Poor for initial velocity |

**Decision:** Use TypeScript. Run backend code in Deno-compatible managed functions and pin/compatibility-test npm dependencies.

### T-02 — Browser application approach

**Inputs:** `A-01`, `NFR-UX-01`, private dashboard scope, `NFR-CON-04..05`.

| Option | Strengths | Costs/risks | Fit |
| --- | --- | --- | --- |
| React SPA built by Vite | Static deployment, simple OAuth callback flow, mature routing/query ecosystem, no server required | Client bundle and explicit API state management | **Best** |
| Next.js full-stack application | Integrated server rendering and routing | Duplicates the selected backend, increases runtime coupling; SEO has no product value here | Overbuilt |
| Server-rendered templates/HTMX | Small client bundle | Couples UI to backend runtime and makes rich flow configuration less convenient | Moderate |

**Decision:** React + Vite + React Router + TanStack Query. Use CSS Modules and shared CSS variables so the styling choice is also resolved.

### T-03 — Backend/data platform

**Inputs:** `A-02..A-07`, `D-01..D-06`, `NFR-CON-04..06`.

| Option | Relational DB | OAuth/RLS | Durable queue/cron | Runtime | Operations/cost |
| --- | --- | --- | --- | --- | --- |
| Supabase Free | PostgreSQL | Integrated Auth + RLS | Postgres Queues + Cron | Edge Functions | One backend account; $0 within quotas; free projects may pause and have no backups/SLA |
| Vercel + Neon + Upstash | PostgreSQL | Separate auth/configuration | Separate queue/cache/scheduler | Node functions | More providers and secrets; free scheduling/limits are fragmented |
| Single VPS + containers | Self-hosted PostgreSQL | Application-owned | Redis/BullMQ + system cron | Unrestricted | Technically straightforward but not $0 and requires server maintenance |

**Decision:** Supabase Free for PostgreSQL, Auth, RLS, Queues, Cron, Edge Functions, secrets, and platform logs. It is the only evaluated candidate that satisfies the logical architecture with one managed backend account and no hosting charge. Accept free-tier pausing, runtime limits, and lack of backups as documented initial-release risks.

### T-04 — Static frontend hosting

**Inputs:** `T-02`, `BR-PROJ-01..03`, `NFR-CON-04..05`, `NFR-CON-07`, `NFR-OPS-04`.

| Option | Strengths | Costs/risks | Fit |
| --- | --- | --- | --- |
| Vercel Hobby | Excellent Vite integration, Git previews, HTTPS, and zero-config SPA deployment | Restricted to personal/non-commercial use, which now matches `BR-PROJ-01` | **Best** |
| Cloudflare Pages Free | Git deployment, previews, HTTPS, SPA/static hosting, free static requests | Equivalent capability but no material simplicity advantage for this small Vite project | Strong fallback |
| GitHub Pages | Very simple static hosting | Weaker environment/preview workflow and SPA routing ergonomics | Acceptable fallback |

**Decision:** Vercel Hobby for the static frontend because the project is explicitly personal/non-commercial and public. This assumes the repository is user-owned; Vercel Hobby does not connect Git organization-owned repositories. Use Vercel only for static assets and previews; all APIs, schedules, queues, and data remain in Supabase. Cloudflare Pages remains the fallback if repository ownership, project scope, or Vercel terms/limits stop fitting.

### T-05 — Queue, scheduling, and shared cache

**Inputs:** `A-03..A-04`, `D-02..D-05`, `NFR-PERF-01..02`, `NFR-REL-01..05`, `NFR-DATA-02..03`.

| Option | Durability | Scheduling/retries | Added infrastructure | Initial-scale fit |
| --- | --- | --- | --- | --- |
| PostgreSQL + `pgmq` + `pg_cron` | Durable transactional messages and visibility leases | Database-native cron; application retry rules | None beyond selected DB | **Best** |
| Redis + BullMQ | Mature workflows, retries, rate limits, high throughput | Strong | Redis plus continuously available worker | Better at scale, fails simplicity/$0 target |
| Upstash Redis + QStash | Managed serverless queue/cache | Managed delivery/schedules | Extra provider, quotas, webhook orchestration | Viable but more moving parts |

**Decision:** Supabase Queues (`pgmq`) and Cron (`pg_cron`). Use indexed source/article records as the shared cache of record and per-invocation memory only as an optimization. Queue/cache interfaces remain replaceable if throughput later warrants Redis/BullMQ.

### T-06 — Authentication and data access

**Inputs:** `BR-USER-01`, `D-01`, `A-01`, `A-06`, `NFR-SEC-01..02`.

| Option | Strengths | Costs/risks | Fit |
| --- | --- | --- | --- |
| Supabase Auth + JWT + RLS | Google/GitHub support, identity stored beside data, database-enforced isolation | Provider coupling | **Best with T-03** |
| Custom OAuth/Auth.js | Portable and flexible | More security-sensitive session/account-linking code; separate persistence | Unnecessary risk |

**Decision:** Supabase Auth with Google/GitHub OAuth using PKCE. Browser/API access uses user JWTs and RLS; privileged workers use narrowly scoped internal functions. Use `@supabase/supabase-js` and versioned SQL migrations rather than adding an ORM. Transactional claims/locks are database functions, not multi-request client sequences.

### T-07 — Feed parsing and article extraction

**Inputs:** `BR-SRC-02..05`, `A-05`, `NFR-PERF-03`, edge CPU/memory limits.

| Option | Strengths | Costs/risks | Fit |
| --- | --- | --- | --- |
| `fast-xml-parser` + Mozilla Readability + `linkedom` | Lightweight feed parsing and general reader-mode extraction without a browser | DOM package must pass Deno/edge compatibility and resource tests | **Best** |
| Browser automation | Highest compatibility with script-rendered sites | Too much CPU/memory/runtime for free edge functions | Reject |
| Site-specific selectors | Fast | Brittle and incompatible with arbitrary user URLs | Reject |

**Decision:** Pin `fast-xml-parser`, `@mozilla/readability`, and `linkedom`; make an Edge Function compatibility/load test a release gate.

### T-08 — Story deduplication

**Inputs:** `BR-FLOW-04`, `NFR-PERF-03`, `NFR-CON-04`.

| Option | Quality | Cost/complexity | Fit |
| --- | --- | --- | --- |
| Normalized title + character n-gram Jaccard | Deterministic; catches syndicated copies | Misses semantic paraphrases | **Best initial option** |
| Embeddings/vector search | Semantic grouping | Additional API/storage/cost and rate limits | Defer |
| AI-only grouping | Strong semantic judgment | Sends duplicates to the paid model and inflates context | Reject for preprocessing |

**Decision:** Local normalized-title and n-gram Jaccard grouping. Reconsider embeddings only when measured duplicate misses justify the cost.

### T-09 — Secret encryption and webhook signing

**Inputs:** `D-04`, `A-06`, `NFR-SEC-03`, `NFR-SEC-06`, `NFR-CON-04`.

| Option | Security | Operations/cost | Fit |
| --- | --- | --- | --- |
| Application AES-256-GCM + HMAC-SHA256 | Authenticated encryption and standard receiver-verifiable signatures | Application owns key rotation | **Best** |
| Database encryption functions | Centralized | Keys can cross SQL/log boundaries; less portable | Weaker boundary |
| External key vault/KMS per operation | Strong audit/rotation | Added provider/cost/latency | Outside initial constraints |

**Decision:** Web Crypto AES-256-GCM with random 96-bit IVs and versioned ciphertext envelopes. Keep a 32-byte master key in backend secrets. Generic webhooks use distinct 32-byte per-channel secrets and HMAC-SHA256.

### T-10 — Transactional email

**Inputs:** `BR-DEL-02`, `NFR-SEC-04`, `NFR-CON-04`, selected edge runtime.

| Option | Free allowance/setup | Runtime compatibility | Fit |
| --- | --- | --- | --- |
| Brevo HTTP API | 300 sends/day on current Free plan; sender verification | HTTP works from Edge Functions | **Best** |
| Resend HTTP API | Excellent developer experience; 100 sends/day on current Free plan | HTTP works; production requires domain verification | Good fallback, lower allowance |
| Direct SMTP | Common protocol | Selected Edge Functions block outbound SMTP ports | Not viable |

**Decision:** Brevo transactional HTTP API. Email remains restricted to the signed-in user's verified address.

### T-11 — AI API

**Inputs:** `BR-FLOW-05..07`, `NFR-CON-03`, `NFR-PERF-03`, `NFR-OPS-03`.

The model is fixed upstream, so model comparison is not a technology decision. The API surface still is:

| Option | Strengths | Costs/risks | Fit |
| --- | --- | --- | --- |
| OpenAI Responses API | Current API, structured outputs, request/usage metadata | Usage-billed | **Best** |
| Chat Completions API | Familiar | No advantage for this greenfield implementation | Valid but not selected |

**Decision:** OpenAI Responses API with `gpt-5.4-mini` and strict structured output.

### T-12 — Observability and tests

**Inputs:** `D-06`, `A-07`, `Q-01..Q-04`, `NFR-CON-04..05`.

| Capability | Options considered | Decision |
| --- | --- | --- |
| Failures/alerts | Separate observability SaaS vs platform logs + durable table | Supabase structured logs + `OperationalEvent` + Brevo operator email; avoids another provider while preserving critical failures beyond short logs |
| Unit/integration tests | Jest vs Vitest | Vitest for fast TypeScript tests; local Supabase for database/function integration |
| Browser tests | Cypress vs Playwright | Playwright for responsive and critical end-to-end flows |
| Package/CI | Multiple package managers vs npm workspaces | npm workspaces, committed npm lockfile, exact Deno dependency versions/lockfile, GitHub Actions CI/CD |

### T-13 — Static analysis and repository security

**Inputs:** `BR-PROJ-02..03`, `NFR-CON-07..08`, `NFR-OPS-04`, `Q-01..Q-03`, `Q-05`.

| Risk/capability | Options considered | Decision and rationale |
| --- | --- | --- |
| TypeScript correctness | Type checking vs transpile-only builds | Strict `tsc --noEmit` for browser/shared packages and `deno check` for Edge Functions; checks both actual runtimes independently of bundling |
| Code quality | ESLint/`typescript-eslint`, Deno lint, or Biome | ESLint + `typescript-eslint` for browser/shared packages and `deno lint` for Edge Functions; each runtime uses its maintained native/mature rule set with zero warnings |
| Formatting | Prettier vs formatter embedded in another tool | Prettier `--check` for browser/shared/docs/config and `deno fmt --check` for Edge Functions; deterministic with explicit file ownership |
| Security SAST | GitHub CodeQL vs Semgrep Community Edition | CodeQL with `security-extended` for JavaScript/TypeScript and GitHub Actions; integrated and available for public GitHub repositories with open-source query packs |
| Dependency changes | `npm audit` only vs GitHub dependency graph tooling | Dependabot alerts/updates plus Dependency Review on pull requests; catches newly introduced vulnerable dependencies before merge |
| Workflow correctness | Manual review vs `actionlint` | Open-source `actionlint` in CI for workflow syntax, expressions, and shell integration checks |
| Secret leakage | CI regex/tool only vs GitHub secret scanning | GitHub secret scanning (automatic for public repositories) plus user push protection; keep sample environment files value-free |
| Database changes | Review only vs executable validation | Validate/lint migrations against the local Supabase database in CI before deployment |

**Decision:** Make all selected checks required pull-request gates. High/critical security findings block merge; lower severity requires a documented disposition. Pin third-party Actions to full commit SHAs and let Dependabot update npm and GitHub Actions dependencies weekly.

Dependency license policy: MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, and 0BSD are pre-approved. AGPL and SSPL dependencies are rejected by default; any other or unknown license requires explicit review and a recorded decision before merge.

### T-14 — Infrastructure as code

**Inputs:** `AT-01`, `AT-11`, `BR-PROJ-02..03`, `NFR-CON-04..08`, `NFR-OPS-04`, `Q-03`, `Q-05`.

| Option | Strengths | Costs/risks | Fit |
| --- | --- | --- | --- |
| Provider-native declarative files + CLIs + idempotent bootstrap/audit scripts | No separate state backend; uses supported deployment paths; configuration reviewed beside code; lowest setup cost | Cannot provision every account/OAuth/console setting; drift audit is partly custom | **Best for one non-commercial environment** |
| OpenTofu with Supabase/Vercel/GitHub providers | Open-source plan/apply workflow, dependency graph, import, drift visibility, reusable environments | Requires secure/locked state and bootstrap credentials; Supabase provider is currently Public Alpha; excessive state/operations for one environment | Revisit when provider maturity or environment count justifies it |
| Pulumi TypeScript | Same application language, programmable resources | Adds a state backend/account or self-managed state; provider abstraction and runtime dependencies | More complexity than value here |
| Manual dashboard configuration | Fast first click-through | Unreviewed, non-reproducible, high drift/onboarding risk | Reject except documented bootstrap boundaries |

**Decision:** Use state-free, provider-native IaC and GitOps for the initial release:

- `supabase/migrations/` owns schema, constraints, RLS, database functions, queue setup, Cron schedules, retention, and Vault secret references.
- `supabase/config.toml` and `supabase/functions/` own local backend configuration and versioned function code.
- `vercel.json` owns SPA rewrites, security headers, and deploy-time frontend configuration that Vercel supports in-repository.
- `.github/workflows/`, `.github/dependabot.yml`, and CodeQL configuration own CI/CD, static analysis, dependency automation, and deployment gates.
- `infra/scripts/` contains idempotent bootstrap/audit scripts for GitHub rules/settings and provider checks that lack stable declarative repository files.
- `.env.example` documents variable names only; values live in GitHub environments and provider secret stores.

One-time account/project creation, OAuth application registration, initial Git linking, and secret entry remain documented bootstrap actions because automating them would introduce more credentials/state than this single environment warrants. They must appear in the hosting checklist and audit output.

Adopt OpenTofu with encrypted, locked remote state when a second long-lived environment is required, repeatable project provisioning becomes frequent, or the Supabase provider is stable enough that plan/apply coverage outweighs state-management cost. Plans run in pull requests and applies run only from a protected environment; state is never committed.

## 3. Selected Stack and Traceability

| Decision | Selected solution | Primary upstream basis |
| --- | --- | --- |
| `T-01` | TypeScript; Deno-compatible backend runtime | `A-01`, `A-04..05`, `NFR-CON-05` |
| `T-02` | React + Vite + React Router + TanStack Query + CSS Modules | `A-01`, `NFR-UX-01`, `NFR-CON-04` |
| `T-03` | Supabase Free: PostgreSQL, Edge Functions, secrets, logs | `A-02..A-07`, `D-01..D-06`, `NFR-CON-04..06` |
| `T-04` | Vercel Hobby static hosting | `T-02`, `BR-PROJ-01..03`, `NFR-CON-04/07`, `NFR-OPS-04` |
| `T-05` | Supabase Queues (`pgmq`), Cron (`pg_cron`), PostgreSQL shared cache state | `A-03..04`, `D-02..05`, `NFR-REL-01..05` |
| `T-06` | Supabase Auth PKCE, JWT/RLS, `supabase-js`, SQL migrations | `BR-USER-01`, `D-01`, `A-06` |
| `T-07` | `fast-xml-parser`, `@mozilla/readability`, `linkedom` | `BR-SRC-02..05`, `A-05` |
| `T-08` | Local normalized-title/n-gram Jaccard deduplication | `BR-FLOW-04`, `NFR-PERF-03` |
| `T-09` | Web Crypto AES-256-GCM; HMAC-SHA256 webhook signatures | `D-04`, `A-06`, `NFR-SEC-03/06` |
| `T-10` | Brevo transactional HTTP API | `BR-DEL-02`, `NFR-SEC-04`, `NFR-CON-04` |
| `T-11` | OpenAI Responses API + `gpt-5.4-mini` | `BR-FLOW-05..07`, `NFR-CON-03` |
| `T-12` | Supabase logs/events, Brevo alerts, Vitest, Playwright, npm workspaces | `D-06`, `A-07`, `Q-01..Q-04` |
| `T-13` | strict `tsc`/`deno check`, ESLint/`deno lint`, Prettier/`deno fmt`, CodeQL, Dependabot, Dependency Review, actionlint, secret scanning | `BR-PROJ-02..03`, `NFR-CON-07..08`, `Q-01..03`, `Q-05` |
| `T-14` | Provider-native declarative IaC, Supabase/Vercel configuration, GitHub workflows, idempotent bootstrap/audit scripts | `AT-01`, `AT-11`, `NFR-CON-04..08`, `Q-03`, `Q-05` |

Required channel adapters follow upstream product scope directly: in-app persistence, Telegram Bot HTTP API, Slack incoming webhooks, and standards-based signed HTTPS generic webhooks.

### 3.1 Architecture tactic realization

| Tactic | Technology realization |
| --- | --- |
| `AT-01` | `T-14` provider-native IaC, GitHub review/apply workflow, idempotent bootstrap/audit scripts, secret stores |
| `AT-02` | PostgreSQL transaction writes domain state and `pgmq` message together; acknowledgement follows commit |
| `AT-03` | Unique source/flow cycle records, `FlowArticle`, delivery-attempt uniqueness, atomic claims, visibility leases |
| `AT-04` | One message/invocation, bounded fetch concurrency/article counts/text/output/retries, delayed durable overflow |
| `AT-05` | Separate jobs/attempts per stage/channel; digest commit precedes independent external deliveries |
| `AT-06` | Adapter error taxonomy, bounded timeout/backoff+jitter, `IntegrationCircuit`, dead-letter queue and replay command |
| `AT-07` | Supabase Auth/RLS, API authorization, Zod validation, SSRF policy, AES-GCM, HMAC, log redaction |
| `AT-08` | Seven-day SQL cleanup, 24-hour cache limit, ID-only `pgmq` messages, 30-day sanitized metadata cleanup |
| `AT-09` | TypeScript ports for source/AI/delivery/queue/clock/encryption with provider contract tests |
| `AT-10` | Structured Supabase logs, domain correlation IDs, `OperationalEvent`, deduplicated Brevo operator alerts |
| `AT-11` | Forward SQL migrations, expand/migrate/contract releases, immutable function/frontend deployments |
| `AT-12` | Stored AI usage, configured work budgets, database/provider thresholds, fail-closed free-tier behavior |

## 4. Runtime Design

### 4.1 Edge Functions

| Function | Authentication | Responsibility |
| --- | --- | --- |
| `api` | User JWT | Profile, source, flow, channel, digest, and feedback operations. |
| `schedule-daily` | Scheduler secret | Finds due flows and enqueues source-cycle jobs. |
| `work` | Scheduler secret | Claims one queue message and dispatches ingestion, AI, or delivery work. |
| `cleanup` | Database schedule; no public endpoint | Deletes expired content and recovers operational leases. |

Cron invokes `work` once per minute. Each invocation claims at most one message and has a 100-second application deadline. This limits per-invocation resource use and provides capacity for 1,440 jobs/day; sustained demand above that is an exit condition.

### 4.2 Schedule and queue contracts

- Daily orchestration: `0 6 * * *`.
- Queue drain: `* * * * *`.
- Cleanup/lease recovery: `*/30 * * * *`.

| Queue | ID-only payload | Domain idempotency key |
| --- | --- | --- |
| `ingestion` | `source_id`, `cycle_date` | `source_id + cycle_date` |
| `processing` | `flow_id`, `cycle_date` | `flow_id + cycle_date` |
| `delivery` | `delivery_attempt_id` | delivery-attempt ID |

After five attempts, move work to dead-letter state and create a sanitized `OperationalEvent`. Never place article text, digests, prompts, or credentials in queue messages.

## 5. API, Security, and Operations

- API routes use JSON over HTTPS under `/functions/v1/api` with a consistent `{ data, error }` envelope and Zod boundary validation.
- Derive the user ID from verified JWT claims; never accept it from request bodies. Enable RLS on every user-owned table.
- Validate source/webhook URLs before every request and after each permitted source redirect. Re-resolve hosts, block non-public addresses, and do not follow generic webhook redirects.
- Encrypt sensitive configurations as `{ version, iv, ciphertext, tag }` with `ENCRYPTION_KEY_V1`; rotation reads the recorded version and rewrites with the current key.
- CORS permits only the production frontend and configured localhost origins.
- Logs include IDs, durations, attempt counts, and provider request IDs but exclude content, prompts, credentials, webhook URLs, and response bodies.
- Repeated failures upsert `OperationalEvent`; send one operator email when critical and suppress duplicate reminders for one hour.
- Retry classified transient failures at most five times using exponential backoff capped at 30 minutes with full jitter; honor a longer valid provider `Retry-After` value.
- Open an `IntegrationCircuit` after five consecutive classified transient failures for the same provider/origin. Start with a five-minute cool-down, allow one atomic half-open probe, close on success, and double the cool-down on probe failure up to one hour.

## 6. AI and Ingestion Limits

- For a feed cycle, fetch readable content for at most the 20 newest unseen entries with concurrency 4 and a 10-second request timeout.
- For a flow, consider at most 50 newest candidates, truncate each extracted article to 2,000 Unicode characters, and cap total article text at 60,000 characters.
- Set AI `max_output_tokens` to 4,000 and request a strict structured digest containing title, language, sections/items, summaries, and source links.
- Retry AI rate limits, timeouts, and server errors. A schema failure gets one repair attempt, then fails the run.
- Persist input/output usage, OpenAI request ID, model, and duration with the processing run.

## 7. Delivery Contracts

- In-app delivery completes when the digest commits.
- Email and in-app channels are created after first OAuth sign-in; email activates only for a verified identity email.
- Telegram uses one application bot and a hashed single-use link code valid for 10 minutes.
- Slack activates only after a successful test request to the encrypted incoming-webhook URL.
- Generic webhook configuration contains an encrypted HTTPS URL and generated 32-byte signing secret. A test event must return 2xx before activation; rotation immediately invalidates the old secret.
- Webhook JSON schema version `1` contains event type, stable event ID (`DigestDeliveryAttempt.id` for digest events), timestamp, flow ID/name, digest ID, and structured digest—never profile data, prompts, tokens, or other channel configuration.
- Sign the exact body as `HMAC-SHA256("<unix_timestamp>.<raw_body>")`; send `X-News-Event-Id`, `X-News-Timestamp`, and `X-News-Signature: v1=<hex_digest>`.
- Webhooks use a 10-second timeout and no redirects. Retry 408, 425, 429, and 5xx; other 4xx responses are permanent for that digest. Disable a channel after five consecutively failed digests and warn the user.
- Slack/Telegram adapters split oversized rendered messages at paragraph boundaries; email sends escaped HTML plus plain text.

## 8. Consequences and Exit Conditions

The selected stack intentionally exchanges throughput and production guarantees for $0 hosting and low setup cost. Move to paid infrastructure or a continuously running worker when:

- the database approaches 400 MB;
- work cannot complete in the daily window or exceeds 1,440 jobs/day;
- Edge Function CPU, memory, duration, or invocation limits repeatedly fail jobs;
- email volume exceeds the free allowance;
- free-project pausing, missing backups, or lack of SLA becomes unacceptable;
- measured database queue/cache contention warrants Redis/BullMQ;
- the application becomes business-critical.
- the project becomes commercial, which invalidates the selected Vercel Hobby hosting constraint.
- multiple long-lived environments or repeated provisioning justify OpenTofu and managed remote state.

## 9. Verified External Evidence

Checked on 2026-07-01:

- [Supabase Queues](https://supabase.com/docs/guides/queues), [Cron](https://supabase.com/docs/guides/cron), and [scheduled Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions).
- [Supabase Edge Function limits](https://supabase.com/docs/guides/functions/limits), [Auth](https://supabase.com/docs/guides/auth), and [Free-plan pricing](https://supabase.com/pricing).
- [Vercel Hobby restrictions](https://vercel.com/docs/plans/hobby) and [Vercel limits](https://vercel.com/docs/limits) (including Git organization repository restrictions); [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/) remain comparison evidence.
- [GitHub CodeQL code scanning](https://docs.github.com/en/code-security/concepts/code-scanning/codeql/codeql-code-scanning), [Dependency Review](https://docs.github.com/en/code-security/concepts/supply-chain-security/dependency-review), [Dependabot alerts](https://docs.github.com/en/code-security/concepts/supply-chain-security/dependabot-alerts), and [public-repository secret scanning](https://docs.github.com/en/code-security/reference/secret-security/secret-scanning-scope).
- [GitHub Actions billing](https://docs.github.com/en/actions/concepts/billing-and-usage) documents free standard GitHub-hosted runners for public repositories.
- [Supabase deployment](https://supabase.com/docs/guides/deployment) documents migrations, configuration, functions, CLI/GitHub deployment, and Terraform support; its [Terraform provider](https://supabase.com/features/terraform-provider) is currently Public Alpha.
- [Vercel Terraform integration](https://vercel.com/kb/guide/integrating-terraform-with-vercel) and [OpenTofu state encryption](https://opentofu.org/docs/v1.10/language/state/encryption/) support the deferred general-purpose IaC path and its state-security requirements.
- [GPT-5.4 mini](https://developers.openai.com/api/docs/models/gpt-5.4-mini).
- [Brevo Free plan](https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans) and [Resend pricing](https://resend.com/docs/knowledge-base/what-is-resend-pricing).
