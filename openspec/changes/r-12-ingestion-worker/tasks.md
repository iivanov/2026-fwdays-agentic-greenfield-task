## 1. Deno Worker Setup and Third-party Libraries Import

- [ ] 1.1 Wire up imports for `fast-xml-parser`, `linkedom`, and `@mozilla/readability` in edge functions configuration map.
- [ ] 1.2 Setup mock interfaces for DNS resolution and custom redirect follow checks.

## 2. Ingestion Handler and Scraper Implementation

- [ ] 2.1 Implement `fetchWithTimeout` supporting 30-second abort timeouts.
- [ ] 2.2 Implement `resolveRedirectAndValidate` verifying SSRF safety on every redirect target hostname and restricting chains to 5 hops max.
- [ ] 2.3 Implement the XML parsing module for RSS and Atom feeds.
- [ ] 2.4 Implement the readability page extraction scraper utilizing linkedom.
- [ ] 2.5 Implement deduplication logic checking unique URL constraints and fingerprint matches prior to ingested articles database write.
- [ ] 2.6 Implement health logging logic updating global source failed fetch counts and pausing sources on 5 consecutive failures.

## 3. Integration and Validation Testing

- [ ] 3.1 Write Vitest integration tests in `packages/browser/src/lib/ingestion-worker.test.ts` verifying feed parsing, redirect SSRF guards, deduplication checks, and source pausing triggers.
- [ ] 3.2 Run format checkers (`prettier --check .`), type checks (`npm run typecheck`), ESLint, and all Vitest test suites.

## 4. Handoff and Verification

- [ ] 4.1 Update process tracking log files `docs/development_process.md` and `docs/state.md`.
- [ ] 4.2 Spawn independent checker sub-agents (Verifier + Reviewer) to inspect and approve R-12 changes.
