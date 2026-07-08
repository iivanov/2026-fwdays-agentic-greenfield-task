## ADDED Requirements

### Requirement: Public Landing Page

The browser application SHALL render a responsive public landing page for
unauthenticated visitors that explains the AI-powered personalized news
aggregator, follows the approved newsroom visual direction, and keeps OAuth
sign-in actions available without exposing development-only password controls in
production (`BR-USER-01`, `BR-PROJ-01..03`, `NFR-SEC-01`,
`NFR-UX-01`, `A-01`, `T-02`, `Q-04`).

#### Scenario: Visitor sees product landing content

- **WHEN** an unauthenticated visitor opens the browser root route
- **THEN** the first viewport presents the product name or offer, a concise
  explanation of source-backed daily digests, and a visual asset representing
  the news desk workflow
- **AND** Google and GitHub sign-in actions are visible
- **AND** development-only email/password controls are not visible in a
  production build

#### Scenario: Protected deep link preserves sign-in shell

- **WHEN** an unauthenticated visitor opens a protected dashboard route
- **THEN** the public landing page is shown instead of authenticated dashboard
  content
- **AND** the route can be safely stored as the post-authentication return path

#### Scenario: OAuth callback error remains visible

- **WHEN** the OAuth callback route receives an error from the provider
- **THEN** the landing page displays a sanitized authentication failure message
  and does not render authenticated dashboard content

### Requirement: Landing Page Responsive Behavior

The public landing page SHALL remain usable at desktop and mobile viewport
sizes without horizontal overflow, overlapping controls, or text escaping its
container (`NFR-UX-01`, `NFR-PERF-02`, `Q-04`, `T-12`).

#### Scenario: Mobile landing page fits viewport

- **WHEN** the landing page is rendered on a mobile viewport
- **THEN** primary copy, sign-in actions, proof points, and workflow sections are
  visible or reachable without horizontal page overflow
- **AND** text wraps or truncates intentionally instead of overlapping controls

