## MODIFIED Requirements

### Requirement: Supabase backend deployment declarations

The repository SHALL declare every Supabase Edge Function that must be deployed
from source control, and deployment audits SHALL fail when a required function
or runtime secret name is omitted.

#### Scenario: Telegram bot function is declared and audited

- **WHEN** deployment configuration is audited
- **THEN** `supabase/config.toml` declares the `telegram-bot` Edge Function
- **AND** `.env.example` and the deployment audit include
  `TELEGRAM_WEBHOOK_SECRET`
- **AND** the deployment guide explains how to register Telegram
  `setWebhook.secret_token` with the deployed function URL
- **AND** the deployment guide documents Telegram's webhook secret character
  and length constraints so operators do not generate rejected secrets
