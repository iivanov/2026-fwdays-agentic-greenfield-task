## MODIFIED Requirements

### Requirement: Google and GitHub OAuth (PKCE Flow)
The system SHALL support user registration and authentication via Google and GitHub OAuth using the PKCE flow, including a browser OAuth callback path that restores the Supabase session before showing authenticated dashboard content (satisfies `BR-USER-01`, `A-01`, `T-02`, `T-06`, `NFR-SEC-01`, `NFR-UX-01`).

#### Scenario: Verify PKCE Configuration in Browser Client
- **WHEN** the browser package client is initialized
- **THEN** the auth configuration has `flowType` set explicitly to `'pkce'`

#### Scenario: Start OAuth with a callback redirect
- **WHEN** a user chooses Google or GitHub sign-in from the browser shell
- **THEN** the Supabase OAuth request uses a same-origin `/auth/callback` redirect URL
- **AND** the requested post-auth dashboard path is stored only when it is a same-origin dashboard path

#### Scenario: Restore session from OAuth callback
- **WHEN** Supabase returns the user to `/auth/callback` after OAuth
- **THEN** the browser shows a session-restoration state until Supabase reports a session
- **AND** the authenticated dashboard is shown after the session is restored
- **AND** the callback URL is replaced by the safe dashboard return path without leaking callback parameters

#### Scenario: Display OAuth callback errors safely
- **WHEN** `/auth/callback` contains OAuth error parameters
- **THEN** the browser clears the callback URL back to `/`
- **AND** the sign-in shell displays a non-secret authentication error
- **AND** authenticated dashboard content is not shown

### Requirement: Local-Only Password Authentication
Email and password authentication SHALL be enabled only for local development and disabled in production (satisfies `BR-USER-01`, `NFR-SEC-01`).

#### Scenario: Verify local configuration
- **WHEN** looking at `supabase/config.toml`
- **THEN** `auth.email.enable_signup` is `true` for local convenience, but documentation/env configuration warns that password auth must be disabled in production

#### Scenario: Hide password controls in production browser builds
- **WHEN** the browser app is built without local development mode or an explicit dev-password-auth flag
- **THEN** the sign-in shell shows Google and GitHub OAuth options
- **AND** it does not render email/password sign-in or sign-up controls

## ADDED Requirements

### Requirement: Authenticated Browser Routing
The browser application SHALL protect dashboard routes and restore authenticated users to the requested dashboard subsection when a valid session exists (satisfies `BR-USER-01`, `A-01`, `T-02`, `T-06`, `NFR-SEC-01`, `NFR-UX-01`).

#### Scenario: Unauthenticated protected dashboard route
- **WHEN** a visitor without a restored session opens `/dashboard` or `/dashboard/{section}`
- **THEN** the sign-in shell is shown instead of dashboard content
- **AND** the safe requested dashboard path is preserved for post-auth navigation

#### Scenario: Authenticated dashboard deep link
- **WHEN** an authenticated user opens `/dashboard/digests`
- **THEN** the dashboard renders with the Digests section selected
- **AND** the layout remains usable on mobile viewports without horizontal overflow

#### Scenario: Authenticated tab navigation updates route
- **WHEN** an authenticated user changes dashboard sections
- **THEN** the selected tab changes
- **AND** the browser path is updated to the matching dashboard path without a full reload

### Requirement: Browser Logout
The browser application SHALL provide logout that clears local authenticated UI state and returns the user to the sign-in shell (satisfies `BR-USER-01`, `A-01`, `T-06`, `NFR-SEC-01`).

#### Scenario: Sign out from dashboard
- **WHEN** an authenticated user chooses Log out
- **THEN** Supabase sign-out is invoked
- **AND** the local session state is cleared
- **AND** the browser path is replaced with `/`
- **AND** dashboard content is not visible until a new session is restored
