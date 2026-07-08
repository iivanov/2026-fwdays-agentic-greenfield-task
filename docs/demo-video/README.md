# Demo Video Package

This folder contains a ready-to-record 1-2 minute demo package for the project:

- `index.html` - animated 16:9 slide deck.
- `styles.css` - slide styling and motion.
- `script.md` - English voiceover script with timings.
- `storyboard.md` - shot list and recording checklist.
- `capture-screenshots.mjs` - Playwright screenshot capture script for local fixture data.
- `generate-voiceover.mjs` - optional OpenAI TTS generator.
- `assets/` - generated screenshots used by the deck.

## Screenshot refresh

Run the browser build with the same fixture flags used by Playwright e2e, then preview it locally:

```bash
VITE_SUPABASE_URL=http://127.0.0.1:54321 \
VITE_SUPABASE_ANON_KEY=e2e-smoke-key \
VITE_E2E_DASHBOARD_FIXTURE=1 \
npm run build --workspace @news-aggregator/browser -- --mode e2e

VITE_SUPABASE_URL=http://127.0.0.1:54321 \
VITE_SUPABASE_ANON_KEY=e2e-smoke-key \
VITE_E2E_DASHBOARD_FIXTURE=1 \
npm run preview --workspace @news-aggregator/browser -- --host 127.0.0.1 --port 4173

node docs/demo-video/capture-screenshots.mjs
```

## Voiceover

`generate-voiceover.mjs` loads `OPENAI_API_KEY` from the environment or local `.env` without printing it and writes `assets/voiceover.mp3`. If OpenAI returns `401`, refresh the API key or billing/project access and rerun the script. The committed package remains usable with a manually recorded voiceover.

Open `index.html` in a browser or serve this directory with any static server. Use the left and right arrow keys to move through slides.
