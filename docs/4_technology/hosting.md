# Minimal Cost Hosting Analysis & Deployment Strategy

This document outlines the hosting options for the AI-Powered Personalized News Aggregator, comparing different deployment models to achieve the **absolute minimal cost** while satisfying the system's performance and data requirements.

---

## 1. Hosting Options Cost Comparison

To host this solution, we require hosting for four components:
1.  **Frontend Dashboard:** Static React SPA.
2.  **API Server & Workers:** Node.js runtime.
3.  **Database:** PostgreSQL.
4.  **Message Queue & Cache:** Redis.

Below is the comparative breakdown of hosting architectures:

| Component | Option C: Single-Instance VPS (Docker Compose) | Option D: Hybrid Serverless (Vercel + GitHub Actions) | Option E: **Fully Vercel Stack (Zero Cost)** |
| :--- | :--- | :--- | :--- |
| **Frontend** | Free (Vercel / Netlify / CDN) | Free (Vercel / Netlify) | **Free** (Vercel) |
| **API Server** | Shared VPS Resource ($0) | Free (Vercel Serverless Functions) | **Free** (Vercel Serverless Functions) |
| **Workers** | Shared VPS Resource ($0) | Free (Scheduled GitHub Actions Runner) | **Free** (Vercel Serverless + Cron / QStash) |
| **PostgreSQL**| Shared VPS Resource ($0) | Free (Neon Serverless Postgres / Supabase) | **Free** (Vercel Postgres / Neon) |
| **Redis / Queue**| Shared VPS Resource ($0) | Bypassed (Managed in DB) | **Free** (Vercel KV / Upstash Redis) |
| **Est. Total**| **$4 - $6 / month** (Flat Rate) | **$0.00 / month** | **$0.00 / month** |
| **Pros** | Simple architecture, standard BullMQ queues, no execution limits, no code workarounds. | Zero hosting cost, no server maintenance, runs simple scripts on GitHub actions without timeouts. | **All assets & state in one ecosystem (Vercel)**, zero cost, automated Vercel Cron scheduling. |
| **Cons** | VPS host crashes; manual OS updates and backups. | Out-of-ecosystem dependencies (GitHub Actions cron runner), scheduling delays. | **10-second timeout limit on Hobby tier** requires complex job chaining or state machine. |

---

## 2. Option C: Single-Instance VPS ($4 - $6/month)

If a robust, real-time background processing queue is needed with standard libraries and zero execution time constraints, a single VPS running Docker Compose is the most straightforward option. Refer to [hosting.md:L35](file:///home/ivdt/tmp/forremove/ai-course/my-project/2026-fwdays-agentic-greenfield-task/docs/4_technology/hosting.md#L35) for details.

---

## 3. Option D: Hybrid Serverless (Vercel + GitHub Actions - $0/month)

Uses Vercel for the API and dashboard, Neon for the database, and schedules a Node script inside a GitHub Actions runner (2,000 free minutes/month) to run the heavy daily scraping and AI tasks. Because GitHub Actions has a 6-hour execution limit, there are no timeout issues. Refer to [hosting.md:L70](file:///home/ivdt/tmp/forremove/ai-course/my-project/2026-fwdays-agentic-greenfield-task/docs/4_technology/hosting.md#L70) for details.

---

## 4. Option E: The Fully Vercel Stack ($0/month)

We can host the entire system on Vercel using the following Vercel ecosystem services (all have generous permanent free tiers):
1.  **Vercel Frontend:** Static dashboard hosting.
2.  **Vercel Postgres (Neon-backed):** $0 tier (250,000 writes/month, 250MB storage).
3.  **Vercel KV (Upstash Redis-backed):** $0 tier (3,000 requests/day, 256MB storage).
4.  **Vercel Cron:** $0 tier (2 cron jobs, max daily or hourly frequency).

```mermaid
graph TD
    subgraph Vercel Cloud Ecosystem (Free Tier)
        V_FE[React Frontend]
        V_API[Vercel Serverless API]
        V_DB[(Vercel Postgres)]
        V_KV[(Vercel KV Redis)]
        V_CRON[Vercel Cron Service]
    end

    subgraph External
        Q[Upstash QStash Message Queue]
        AI[gpt-5.4-mini AI API]
        DEL[Telegram / Slack / SMTP]
    end

    V_FE <-->|HTTPS| V_API
    V_API <-->|SQL Queries| V_DB
    V_API <-->|Redis Cache/State| V_KV

    V_CRON -->|1. Daily Trigger| V_API
    V_API -->|2. Publish Jobs| Q
    Q -->|3. Delayed Webhooks < 10s| V_API
    V_API -->|4. Summarize & Group| AI
    V_API -->|5. Deliver Digests| DEL
```

### 4.1 The 10-Second Execution Limit Challenge

On Vercel's **Hobby (Free) Tier**, a serverless function has a hard execution limit of **10 seconds**. 
Ingestion, parsing multiple URLs, fetching AI summaries, and delivery will easily exceed 10 seconds in a single run. If the function takes longer, Vercel terminates it with a **504 Gateway Timeout**.

### 4.2 Workarounds to Achieve Zero Cost on Vercel

To host the entire project on Vercel for free, we must break up the execution flow into smaller steps that each take under 5 seconds. Two design options are available:

#### Workaround A: Serverless Queue Chaining with Upstash QStash (Recommended)
Upstash QStash is a serverless messaging queue that has a free tier of **2,000 messages/day** ($0). 
Instead of running a monolithic processing flow, we write modular API routes and chain them:

1.  **Trigger:** Vercel Cron hits `/api/cron/start-ingestion` once a day.
2.  **Queue Sources:** The endpoint queries Vercel Postgres for active sources, writes them to Vercel KV, and publishes a message to QStash for each source url.
3.  **Process Ingestion:** QStash sends a webhook call back to Vercel at `/api/jobs/ingest-source` for each url. Vercel fetches, parses the HTML with Readability, saves the `IngestedArticle` to Postgres, and completes in ~2 seconds.
4.  **AI Aggregation:** Once all sources are ingested, QStash triggers `/api/jobs/process-ai` for each flow. The endpoint retrieves the articles, calls the `gpt-5.4-mini` API, stores the `ProcessedDigest`, and finishes in ~4 seconds.
5.  **Delivery:** A final QStash call triggers `/api/jobs/deliver-digest`, which decrypts the tokens and calls Slack/Telegram/SMTP in ~1 second.

#### Workaround B: Database-Backed State Machine
If we want to avoid QStash and only use Vercel Postgres and Vercel Cron:

1.  **Trigger:** Vercel Cron hits `/api/cron/step-processor` every hour (or daily).
2.  **Query next task:** The endpoint queries PostgreSQL for the next item in a queue table.
3.  **Process single item:** It processes **one** source fetch, **one** AI flow synthesis, or **one** notification delivery, updates the status in the database, and terminates immediately (taking ~2-3 seconds).
4.  **Self-Invocation:** Before exiting, it triggers a background HTTP fetch call to itself (`/api/cron/step-processor`) to process the next item. The loop terminates when no pending tasks remain.

---

## 6. Summary Recommendations for Greenfield Phase

*   **If you want simplicity and fast progress:** Choose **Option C (VPS + Docker Compose)**. It costs $4-$6/mo but saves you from writing complex async webhook handlers, state machines, or managing Vercel's 10s limitations.
*   **If you want $0 cost with the simplest code:** Choose **Option D (Vercel + GitHub Actions)**. The API is hosted on Vercel, and the background worker is just a standard Node script run via GitHub Actions. There are no timeout limits, and it requires zero architectural workarounds.
*   **If you want a unified ecosystem on Vercel for $0:** Choose **Option E (Fully Vercel Stack)**. Be prepared to implement the QStash or state-machine routing architecture to prevent 504 gateway timeouts on the Hobby tier.
