# source-management Delta

## ADDED Requirements

### Requirement: Outbound source requests MUST revalidate DNS immediately before fetch

Outbound source and URL verification requests MUST re-run SSRF DNS/address
validation immediately before each network request.

#### Scenario: DNS rebinding changes a host to private IPs

- **WHEN** a hostname that previously resolved to public IPs resolves to a
  private, loopback, link-local, reserved, or cloud-metadata address at outbound
  request time
- **THEN** the request is rejected before fetch is invoked.

### Requirement: Source redirects MUST be manually revalidated

Source-style outbound requests that follow redirects MUST disable native
redirect following and revalidate every redirect target before requesting it.

#### Scenario: Redirect target resolves to metadata address

- **WHEN** a safe source URL returns a redirect to a URL resolving to
  `169.254.169.254`
- **THEN** the redirect is rejected
- **AND** the metadata target is not fetched.
