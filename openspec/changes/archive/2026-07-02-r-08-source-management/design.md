## Context

Ingesting articles from user-provided URLs introduces security vulnerabilities, specifically Server-Side Request Forgery (SSRF) where the server is tricked into connecting to internal services, loopbacks, or cloud provider metadata APIs. To mitigate this while fulfilling the requirement for source management, the API must validate URLs against an IP checklist and manage global shared feeds separately from per-flow links.

## Goals / Non-Goals

**Goals:**
- Implement SSRF defense checking hostname resolutions against private/loopback IPv4 and IPv6 networks.
- Expose `/sources` endpoints (`GET`, `POST`, `DELETE`) with flow ownership verification.
- Auto-create a default briefing flow in the UI to prevent empty state blocking.
- Construct the `SourcesPanel` settings interface allowing users to link feeds to flows.

**Non-Goals:**
- Ingesting article content or fetching feed XML structures (reserved for workers).
- Setting up proxy caches or rate-limiters.

## Decisions

### 1. Elevated Global Source Ingestion
- **Rationale**: Since global sources are shared uniquely (`url unique`), users cannot have direct write policies on `global_sources`. The POST route uses the elevated `supabaseAdmin` client to find or create the shared global URL, and then inserts the link in `flow_sources` using the user's client to confirm RLS ownership.
- **Alternative**: Granting users insert permissions on `global_sources`. *Rejected* as it would expose global records to malicious modification.

### 2. Environment-Agnostic DNS resolver
- **Rationale**: Deno's native `resolveDns` fails in Node.js test runs. We designed a dual resolver checks that falls back to Node's `node:dns` lookup under Vitest.
- **Alternative**: Mocking global `Deno` in tests. *Rejected* as it causes runtime conflicts under standard test suites.

## Risks / Trade-offs

- **Risk**: DNS Rebinding where a domain changes IP to local range after verification.
- **Mitigation**: Future ingestion worker cycles must revalidate IP scopes immediately before executing outbound fetches.
