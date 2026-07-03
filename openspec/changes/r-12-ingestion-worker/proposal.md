## Why

Enables feed parsing and article content extraction from configured ingestion sources (RSS/Atom feeds and single article URLs). This change delivers the vertical slice that resolves external fetch operations safely, sanitizes HTML inputs, handles redirects under strict SSRF validation limits, deduplicates fetched items, and monitors source health.

## What Changes

- **Worker Implementation**: Adds feed parser and article scraper logic inside the `work` Edge Function background worker.
- **SSRF Redirect Verification**: Implements dynamic SSRF validation on redirect target URLs (up to 5 redirects allowed).
- **RSS/Atom Feed Parser**: Integrates `fast-xml-parser` to extract items (title, description, publication date, link) from XML feeds.
- **Readability Scraper**: Integrates `linkedom` and `@mozilla/readability` to extract clean main text content from HTML pages.
- **Deduplication**: Adds database duplicate filters to reject already-ingested articles (based on URL/fingerprint uniqueness).
- **Source Health Monitoring**: Increments failure count on execution errors, logging operational events, and automatically pausing sources after 5 consecutive fetch errors.

## Capabilities

### New Capabilities
- `ingestion-worker`: Feed parsing, page scraping, redirect validation, item deduplication, and source health monitoring capabilities.

### Modified Capabilities
<!-- No requirement changes to existing capabilities -->

## Impact

- **Database**: Updates `global_sources` status to paused on consecutive fetch failure threshold triggers.
- **Edge Functions**: Implements the ingestion worker runner inside `supabase/functions/work/`.
- **Dependencies**: Adds `fast-xml-parser`, `linkedom`, and `@mozilla/readability` to the Edge Function packages imports.
- **Tests**: Adds Vitest suites under `packages/browser/src/lib/` to verify ingestion, parsing, SSRF redirect boundaries, and health degradation logic.
