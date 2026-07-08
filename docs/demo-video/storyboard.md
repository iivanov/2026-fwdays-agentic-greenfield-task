# Storyboard And Recording Checklist

## Shot List

| Time | Visual | Screen action |
| --- | --- | --- |
| 0-8s | Title slide | Animated sources-to-digest pipeline appears. |
| 8-22s | Landing page screenshot | Slow zoom toward the product promise and sign-in actions. |
| 22-40s | Dashboard overview screenshot | Highlight flows, source warnings, and latest digest status. |
| 40-55s | Digest and delivery split slide | Show digest feedback beside channel setup. |
| 55-72s | Agentic build loop slide | Animate requirements, OpenSpec, maker, verifier, reviewer, archive. |
| 72-84s | Evidence slide | Show repo artifacts: rules, process summary, tests, checker reports. |
| 84-90s | Closing slide | Hold product plus process message and AI voice disclosure. |

## Screenshot Capture

1. Build the browser app with `VITE_E2E_DASHBOARD_FIXTURE=1` and `--mode e2e`.
2. Preview the browser app on `http://127.0.0.1:4173`.
3. Run `node docs/demo-video/capture-screenshots.mjs`.
4. Confirm screenshots exist under `docs/demo-video/assets/`.
5. Open `docs/demo-video/index.html` and step through slides with arrow keys.

## Voiceover

Preferred path:

1. Export `OPENAI_API_KEY` in the shell without printing it.
2. Run `node docs/demo-video/generate-voiceover.mjs`.
3. Use `docs/demo-video/assets/voiceover.mp3` in the editor.
4. The current generated file is `docs/demo-video/assets/voiceover.mp3` and is about 81 seconds long.

Fallback path: record the narration from `script.md` manually, then keep the same slide timings.

## Editing

- Record the deck at 1920x1080.
- Use about 12 seconds per slide, with the final slide held for 6 seconds.
- Keep cursor movement minimal; the screenshots and callouts should carry the story.
- Include a small caption on the final slide: "Voiceover generated with AI text-to-speech" when AI audio is used.
- Automated rendering is available with `node docs/demo-video/render-video.mjs`; it writes `docs/demo-video/demo-video.mp4`.
