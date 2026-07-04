## Why

Stored source and webhook URLs are currently validated before persistence or
verification, but outbound request helpers still call `fetch` after that
validation. That leaves a time-of-check/time-of-use gap for DNS rebinding and
does not provide a reusable redirect-validation path for source fetching.

## What Changes

- Add a protected outbound fetch helper that validates the URL immediately
  before every request.
- Disable native redirects for protected requests.
- Support manual redirects only when explicitly allowed, with every redirect
  target revalidated before follow-up.
- Keep generic webhook and Slack verification on no-redirect behavior.
- Add tests for DNS rebinding-style resolution changes and redirect targets that
  resolve to private/cloud-metadata addresses.

## Upstream IDs

- A-06
- AT-07
- NFR-SEC-05

## Non-goals

- Implementing the full R-12 ingestion worker.
- Adding browser-level SSRF behavior.
- Changing source URL canonicalization or storage uniqueness.
- Allowing redirects for generic webhooks.
