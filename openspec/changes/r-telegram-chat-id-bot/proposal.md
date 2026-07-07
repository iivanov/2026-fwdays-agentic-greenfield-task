## Why

Telegram delivery setup currently requires operators to know how to discover a
chat ID manually. The dashboard names the app-owned bot, but the experience is
still too technical for normal setup and can accidentally push operators toward
handling the bot token outside the secret store.

## What Changes

- Add an inbound Telegram bot Edge Function that receives webhook updates,
  validates Telegram's webhook secret header, extracts the chat ID, and replies
  with the exact dashboard field where that ID belongs.
- Declare the new function and `TELEGRAM_WEBHOOK_SECRET` in deployment/audit
  configuration.
- Update the Delivery tab and deployment guide to make `@news_desk_ai_bot` the
  primary chat-ID discovery path, while keeping bot tokens out of the browser.
- Add focused unit and browser smoke coverage.

## Capabilities

### Modified Capabilities

- `delivery-channels`: Telegram setup and dashboard guidance.
- `deployment-bootstrap`: Supabase function declarations and runtime secrets.

## Impact

- Affected Supabase code: `supabase/functions/telegram-bot/index.ts`,
  `supabase/config.toml`, and deployment audit config.
- Affected frontend code: `packages/browser/src/components/DeliveryPanel.tsx`.
- Affected docs: deployment setup guide, hosting notes, state/process record.
- No database schema change is required.

Upstream: `BR-DEL-03`, `NFR-SEC-03`, `NFR-UX-01`, `T-10`, `T-14`.
