## MODIFIED Requirements

### Requirement: Public Landing Page
The browser application SHALL render a responsive public landing page for unauthenticated visitors that explains the AI-powered personalized news aggregator, follows the approved newsroom visual direction, keeps OAuth sign-in actions available, and exposes the project demo video without development-only password controls in production.

#### Scenario: Visitor can watch the project demo video
- **WHEN** an unauthenticated visitor opens the browser root route
- **THEN** the landing page includes a project demo video section
- **AND** the video is playable through native browser controls
- **AND** the section explains that the video covers the product and agentic build process

### Requirement: Landing Page Responsive Behavior
The public landing page SHALL remain usable at desktop and mobile viewport sizes without horizontal overflow, overlapping controls, or text escaping its container, including the embedded project demo video section.

#### Scenario: Demo video fits mobile viewport
- **WHEN** the landing page is rendered on a mobile viewport
- **THEN** the demo video section remains visible without horizontal page overflow
- **AND** the video scales within its container
