## MODIFIED Requirements

### Requirement: Repository Demo Video Package
The repository SHALL provide a self-contained demo-video package and browser-served final browser video that supports recording and viewing a 1-2 minute product and agentic-development demo without requiring production data, external slide tooling, or committed secrets.

#### Scenario: Final browser video is available to the browser landing page
- **WHEN** the browser app is built
- **THEN** the generated demo video is available as `/demo-video.webm`
- **AND** the served asset uses the `video/webm` content type
