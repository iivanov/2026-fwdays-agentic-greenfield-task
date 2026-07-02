## Why

Users need a way to connect automated RSS/Atom feeds and individual article page links to their daily processing flows. At the same time, we must enforce strict SSRF defenses to prevent users from adding loops or private IP locations that could target internal networks or cloud metadata APIs.

## What Changes

- **SSRF Validation Module**: Created `supabase/functions/api/ssrf.ts` to parse URLs, resolve host DNS records, and reject private/reserved IP blocks.
- **API Source Routes**: Implemented `GET /sources`, `POST /sources`, and `DELETE /sources` endpoints inside the API edge function helpers.
- **Dashboard Source panel**: Created `SourcesPanel.tsx` in React to select flows, add format-typed URLs, and review linked feeds.
- **Default Flow Auto-Scaffold**: Added support in the dashboard UI to initialize a default processing briefing flow if the user doesn't have one configured yet.

## Capabilities

### New Capabilities

- `source-management`: Connect, manage, and disconnect news feeds and article URLs to user flows, secured via host SSRF address checking.

### Modified Capabilities
