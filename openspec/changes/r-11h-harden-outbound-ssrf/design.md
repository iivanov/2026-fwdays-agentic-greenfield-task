## Design

The SSRF module owns both validation and protected outbound HTTP request
execution. A new `fetchWithSsrfProtection` helper accepts a URL, request
options, a DNS resolver, and an injected fetch implementation for tests.

## Outbound Policy

- Validate the initial URL immediately before fetch.
- Use `redirect: 'manual'` so the runtime cannot follow an unsafe redirect before
  application validation.
- For no-redirect callers, return the first response and let callers decide
  whether a 3xx is acceptable.
- For source-style callers that allow redirects, follow only a bounded number of
  redirects. Resolve relative `Location` values against the current URL and
  re-run the same SSRF validation before every follow-up request.
- Fail closed on malformed URLs, failed DNS resolution, unsafe resolved
  addresses, missing redirect locations, or excessive redirect chains.

## Security

This narrows the DNS rebinding window by moving DNS validation into the helper
that performs the outbound request and by revalidating every redirect target.
It cannot force the platform HTTP client to connect to a specific validated IP,
so the implementation documents this as best-effort defense in the selected
Edge runtime while keeping all application-controlled redirects fail-closed.

## Verification

Unit tests cover:

- a resolver that returns public addresses at create-time but private addresses
  at outbound fetch time;
- a redirect from a safe URL to metadata/private address;
- a safe relative redirect;
- no-redirect webhook verification preserving redirect blocking.
