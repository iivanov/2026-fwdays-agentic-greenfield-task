## Why

`BR-FLOW-08` requires users to rate generated digests and for the initial
release to store and report that feedback. The processing and delivery slices
already persist digests, but users still have no authenticated API or dashboard
surface for thumbs up/down feedback.

## What Changes

- Add authenticated digest history/reporting API support that returns the
  user's own retained digests with their current feedback value.
- Add an authenticated feedback update API that accepts only `thumbs_up`,
  `thumbs_down`, or `none` for a digest owned by the caller.
- Add dashboard digest history controls that let the user set or clear thumbs
  up/down feedback.
- Add automated coverage for validation, ownership enforcement, reporting
  counts, and the browser feedback workflow.
- Non-goal: automatic prompt adaptation or any mutation of flow prompts based
  on feedback.

## Capabilities

### New Capabilities

- `digest-feedback`: Authenticated digest reporting and thumbs up/down feedback
  capture for retained processed digests.

### Modified Capabilities

- None.

## Impact

- Upstream IDs: `BR-FLOW-08`, `D-03`, `A-01`, `A-06`, `Q-01`, `Q-02`,
  `Q-04`, `T-02`, `T-03`, `T-12`.
- Affected API: `supabase/functions/api/helpers.ts`.
- Affected browser UI: authenticated dashboard navigation and digest feedback
  panel under `packages/browser/src/`.
- Affected tests: Vitest API/browser unit coverage and existing local
  verification gates.
- No new external services, provider credentials, paid capabilities, or schema
  tables are introduced. Existing `processed_digests.user_feedback` and RLS are
  used.
