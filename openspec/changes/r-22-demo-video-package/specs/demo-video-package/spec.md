## ADDED Requirements

### Requirement: Repository Demo Video Package
The repository SHALL provide a self-contained demo-video package that supports recording a 1-2 minute product and agentic-development demo without requiring production data, external slide tooling, or committed secrets (satisfies `BR-PROJ-02..03`, `NFR-UX-01`, `Q-04`, `Q-05`).

#### Scenario: Slide deck is available locally
- **WHEN** a contributor opens `docs/demo-video/index.html`
- **THEN** the deck presents the product concept, product screenshots, agentic build loop, process evidence, and closing takeaway
- **AND** slides can be advanced with keyboard controls or visible buttons

#### Scenario: Screenshots use deterministic fixture data
- **WHEN** `node docs/demo-video/capture-screenshots.mjs` runs against the local e2e fixture preview
- **THEN** it writes landing, dashboard overview, digest feedback, delivery channel, and process-evidence screenshots under `docs/demo-video/assets/`
- **AND** the screenshots do not require production accounts, production data, or secret values

#### Scenario: Voiceover can be generated without secret disclosure
- **WHEN** `node docs/demo-video/generate-voiceover.mjs` runs with a valid `OPENAI_API_KEY` in local `.env`
- **THEN** it writes `docs/demo-video/assets/voiceover.mp3`
- **AND** it does not print the secret value
- **AND** it prefers the local `.env` key over a different exported shell key for this repo-local generation task

#### Scenario: Recording instructions remain explicit
- **WHEN** a contributor reads `docs/demo-video/README.md` or `docs/demo-video/storyboard.md`
- **THEN** the required screenshot refresh commands, voiceover path, target timing, and AI voice disclosure guidance are documented

#### Scenario: Final browser video can be rendered
- **WHEN** `node docs/demo-video/render-video.mjs` runs after screenshots and voiceover exist
- **THEN** it writes `docs/demo-video/demo-video.webm`
- **AND** the rendered video combines slide visuals with the generated voiceover inside the 1-2 minute target window
