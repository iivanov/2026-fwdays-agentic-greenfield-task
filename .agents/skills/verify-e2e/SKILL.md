---
name: verify-e2e
description: Behavioral verification with the Playwright CLI. Run the app, exercise the change's acceptance scenarios end-to-end, and emit a committed verification artifact (report + screenshots) that proves the result. Use as the behavioral half of the verification gate, especially for UI/API changes. Run by the verifier sub-agent, not the maker.
metadata:
  role: checker
  version: "1.0"
---

# Skill: End-to-end verification with Playwright (produces a verification artifact)

## Objective

Prove a change actually behaves as its specs claim by driving the real app with
the **Playwright CLI**, then produce a **verification artifact** (a committed
report + screenshots/traces) that is the evidence for the verification gate.
This complements `verify-change` (static gates: types, lint, unit tests). Builds
on the installed `webapp-testing` skill.

## Rules of engagement

- Run by a sub-agent separate from the maker (`.agent/rules/20-maker-checker.md`).
- Verify behavior against the change's acceptance **scenarios** (from its delta
  `specs`), including the error/abuse path, not just the happy path.
- Only claim a pass if Playwright actually ran and the assertions passed. A test
  that could not run is "not run", never "passed".
- Never weaken the app, RLS, or a security check to make a test go green.
- Use mocks/stubs for paid or external providers (OpenAI, Brevo, Telegram,
  Slack, arbitrary webhooks) and a local Supabase for data.

## Instructions

1. **Ensure Playwright is available.** If `@playwright/test` and browsers are
   not installed yet, add them as part of this change (`npm i -D
   @playwright/test` + `npx playwright install --with-deps chromium`) and create
   a minimal `playwright.config.ts` (base URL, HTML + list reporters,
   screenshot/trace on failure). Record this in the change.
2. **Bring up the app under test.** Start the frontend/dev server and the local
   Supabase + Edge Functions (or use `webapp-testing`'s `scripts/with_server.py`
   helper to run tests against a started server). Seed any fixtures the scenario
   needs.
3. **Write/extend e2e specs** derived from the change's acceptance scenarios
   (e.g. sign-in gate, create a flow within the 5-flow quota, add an RSS source,
   see a digest, receive a `no_content` outcome). Keep them deterministic.
4. **Run headless:** `npx playwright test --reporter=html,list`. Capture the
   exit code.
5. **Emit the verification artifact:**
   - Write `openspec/changes/<name>/verification.md` — a committed summary:
     change id + requirement IDs, each scenario → pass/fail, the exact commands
     run, links to screenshots/trace, and the overall verdict.
   - Keep the raw Playwright HTML report and traces under the gitignored
     `playwright-report/` and `test-results/` (regenerable); reference their
     paths from the summary. In Antigravity, surface the run as an artifact
     (report/screenshots) so the result is inspectable.
6. **Report** PASS only if every scenario passed; otherwise FAIL with the failing
   scenario, the assertion, and the smallest repro.

## Output

- `openspec/changes/<name>/verification.md` (committed evidence) + the raw
  Playwright report/traces (gitignored).
- A PASS/FAIL verdict feeding the verification gate. On FAIL, hand the failing
  scenarios back to the maker.
