## Context

The backend background worker executes inside Deno Edge Functions, invoked periodically via database triggers and cron jobs. The database contains tables tracking ingestion runs (`source_fetch_runs`) and sources (`global_sources`), but active HTTP fetching, HTML scraping, feed parsing, and redirect-sensitive SSRF checks are not implemented.

This design details the worker integration of feed parsing (RSS/Atom) and article web page scraping (Readability) with robust SSRF protections, unique fingerprint deduplication, and source-level health degradation.

## Goals / Non-Goals

**Goals:**
- Implement HTML body scraping using `@mozilla/readability` and `linkedom`.
- Implement RSS and Atom XML feed parsing using `fast-xml-parser`.
- Enforce strict 30-second network fetch timeouts.
- Implement SSRF-safe redirect following (up to 5 hops, re-validating every redirect target address range).
- Perform article item deduplication checking URLs/fingerprints before database inserts.
- Track source health: increment failures on fetch errors, reset on success, and automatically pause sources after 5 consecutive failures.

**Non-Goals:**
- AI digest compilation (R-13) and final digest channel delivery (R-14) are out of scope.

## Decisions

1. **Integrated Ingestion inside Deno Edge Function (`work`):**
   - *Rationale*: Reuses the claimed job dispatch loops and Supabase Edge Functions execution limits while keeping all background jobs unified.
2. **SSRF Redirect Resolver Middleware:**
   - *Rationale*: We override standard `fetch` or use a custom HTTP client helper that checks resolving IP ranges before following redirects. Deno's `fetch` by default automatically follows redirects, so we must disable automatic redirect following (`redirect: 'manual'`) and follow them programmatically, performing DNS resolution and SSRF checks on the target URL at each step.
3. **Linkedom + @mozilla/readability for HTML Scraping:**
   - *Rationale*: Both are lightweight, pure JavaScript libraries that execute cleanly in Deno without external headless browser engines (Playwright/Puppeteer), maintaining $0 free-tier constraints.
4. **Fast XML Parser:**
   - *Rationale*: Fast XML Parser is highly performant and secure against XXE (XML External Entity) injection attacks.

## Risks / Trade-offs

- **[Risk]**: CPU and memory limits inside Deno Edge Functions on free-tier (150MB memory) when parsing large XML feeds.
  - *Mitigation*: Limit maximum size of fetched feeds/pages (e.g. abort if response body exceeds 2MB).
- **[Risk]**: DNS resolution of loopback ranges during redirect chains.
  - *Mitigation*: Check and resolve the hostname of every redirect URL to its IP address, verifying it does not resolve to private/loopback/link-local ranges before issuing the next fetch request.
