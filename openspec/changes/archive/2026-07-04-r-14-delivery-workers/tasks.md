## 1. OpenSpec and Migration

- [x] 1.1 Define R-14 delivery-worker requirements and scenarios.
- [x] 1.2 Add a forward migration for delivery attempt creation, retry/backoff,
      circuit state, channel failure accounting, and queue acknowledgement.

## 2. Worker Implementation

- [x] 2.1 Enqueue delivery attempts after digest persistence without placing
      digest content or credentials in queue messages.
- [x] 2.2 Implement in-app, Brevo email, Telegram, Slack, and generic signed
      webhook adapters with bounded timeouts.
- [x] 2.3 Revalidate Slack/generic webhook URLs before every outbound request,
      block redirects, and sign generic webhook payloads.
- [x] 2.4 Classify transient/permanent failures, honor `Retry-After`, and update
      circuit/channel state through transactional RPCs.

## 3. Tests and Documentation

- [x] 3.1 Add focused worker tests for attempt enqueueing, adapter payloads,
      webhook signatures, SSRF redirect blocking, and failure classification.
- [x] 3.2 Add or update Supabase integration coverage for delivery attempt
      creation and retry/backoff SQL behavior.
- [x] 3.3 Update `docs/state.md`, `docs/roadmap.md`, and
      `docs/development_process.md`.

## 4. Verification and Checker Loop

- [x] 4.1 Run applicable maker self-checks.
- [x] 4.2 Run independent verifier sub-agent on the final diff and retain its
      report.
- [x] 4.3 Run independent reviewer sub-agent on the final diff and retain its
      report.
- [x] 4.4 Fix any blocking checker findings, rerun both checker passes, archive
      the OpenSpec change, and commit the stage.
