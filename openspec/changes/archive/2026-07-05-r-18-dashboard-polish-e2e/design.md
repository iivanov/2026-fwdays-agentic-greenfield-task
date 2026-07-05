## Design

### Dashboard information architecture

The authenticated browser shell will keep the existing five domain panels
(`Preferences`, `Sources`, `Flows`, `Delivery`, `Digests`) and add an initial
overview surface focused on repeated operation:

- flow run status: enabled/paused state, last run, next run, prompt mode, and
  no-content/completed/failed status when available;
- source health: active/paused state, failed fetch count, last fetched time, and
  visible warnings for paused or repeatedly failing sources;
- digest history: retained digest title, flow name, created time, item count,
  and current feedback state.

The overview reads existing durable state and API results. It must not add a
"run now" command or any long-running request path in this slice.

### Visual direction

Implement the approved `docs/DESIGN.md` "Sophisticated Newsroom" direction:
light editorial surfaces, crisp 1px rules, restrained navy/slate text, compact
status chips, Source Serif-style headings with system fallbacks, Inter-style
body text with system fallbacks, and monospaced metadata labels.

Design plan:

- Palette: `paper` `#f7f9fb`, `sheet` `#ffffff`, `ink` `#191c1e`, `slate`
  `#45464d`, `rule` `#d8dadc`, `navy` `#0f172a`, `blue` `#2563eb`,
  `green` `#059669`, `amber` `#d97706`, `red` `#dc2626`.
- Type: editorial headings use `Source Serif 4, Georgia, serif`; UI/body text
  uses `Inter, ui-sans-serif, system-ui`; counters/metadata use
  `JetBrains Mono, ui-monospace, SFMono-Regular, monospace`.
- Layout: a sticky top masthead, horizontal tabs that collapse to a scrollable
  segmented nav on small screens, a full-width overview band, then dense
  two-column dashboard sections on desktop and single-column sections on
  mobile.
- Signature element: a "run ledger" strip that reads like a newsroom production
  rail: digest, flow, source, and delivery status chips aligned to durable
  operational facts.

### Responsive behavior

- At desktop widths, overview metrics and the primary work surface may use a
  two-column grid with bounded minmax tracks.
- At mobile widths, the masthead stacks, tabs become horizontally scrollable,
  forms and tables become card-like rows, and all interactive controls retain
  at least 36px height.
- Text must wrap or truncate intentionally; buttons must not resize the layout
  during loading or pending states.

### Test approach

- Extend Playwright from login-only smoke to authenticated-dashboard behavior
  using deterministic test fixtures/mocks instead of real provider accounts.
- Verify desktop and mobile viewports for:
  - login shell remains accessible;
  - authenticated shell exposes tabs without overlap;
  - overview shows digest history, flow run status, and source warnings;
  - digest feedback controls remain reachable;
  - no horizontal overflow on mobile.
- Keep existing unit gates; add focused Vitest only where data derivation is
  extracted from React components.

### Non-goals

- No OAuth callback/session lifecycle repair; R-20 owns authenticated routing
  and full auth lifecycle.
- No backend schema/API changes unless a small read-shape helper is unavoidable.
- No new dashboard metrics pipeline, external screenshots service, or paid
  observability product.
