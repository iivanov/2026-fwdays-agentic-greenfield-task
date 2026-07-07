## 1. Specification and Design

- [x] 1.1 Create OpenSpec proposal, design, tasks, and delta specs for Telegram
  chat-ID bot setup.
- [x] 1.2 Update state/process docs with the human correction and evidence.

## 2. Runtime Implementation

- [x] 2.1 Add the `telegram-bot` Edge Function with webhook-secret validation
  and chat-ID reply behavior.
- [x] 2.2 Declare `telegram-bot` in `supabase/config.toml` and deployment audit.
- [x] 2.3 Add `TELEGRAM_WEBHOOK_SECRET` to environment/audit documentation.
- [x] 2.4 Update the Delivery tab to describe the auto-reply flow for
  `@news_desk_ai_bot`.

## 3. Tests and Verification

- [x] 3.1 Add unit coverage for webhook authentication and chat-ID replies.
- [x] 3.2 Add browser smoke coverage for Telegram setup guidance.
- [x] 3.3 Run focused unit, Deno, frontend, OpenSpec, and deployment audit gates.
- [x] 3.4 Run independent verifier and reviewer passes on the final diff.
