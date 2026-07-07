## Design

Telegram chat linking will use one application-owned bot, currently
`@news_desk_ai_bot`. The browser still collects only `config.chat_id`; it never
collects `TELEGRAM_BOT_TOKEN` or `TELEGRAM_WEBHOOK_SECRET`.

### Inbound Bot Function

The new `telegram-bot` Supabase Edge Function is a public Telegram webhook
target with `verify_jwt = false`, because Telegram cannot send Supabase user
JWTs. It authenticates requests with Telegram's
`X-Telegram-Bot-Api-Secret-Token` header. The expected value is stored in
Supabase Edge Function secrets as `TELEGRAM_WEBHOOK_SECRET` and also configured
with Telegram `setWebhook.secret_token`. Telegram accepts webhook secret tokens
from 1 to 256 characters using only `A-Z`, `a-z`, `0-9`, `_`, and `-`, so the
operator guide must avoid arbitrary password-manager symbols.

When a message, edited message, channel post, or edited channel post arrives,
the function extracts `chat.id`, sends a `sendMessage` response to that chat,
and includes:

- the chat ID exactly as Telegram returned it;
- the dashboard path: `Delivery -> Telegram Chat ID`;
- a reminder not to paste the bot token into the dashboard.

Updates without a chat ID or sent by bots are acknowledged and ignored.

### Operator Flow

Direct chat:

1. User opens `https://t.me/news_desk_ai_bot`.
2. User sends any message.
3. Bot replies with the chat ID.
4. User pastes the value into Delivery -> Telegram Chat ID and verifies.

Group chat:

1. User adds `@news_desk_ai_bot` to the group.
2. User sends or mentions the bot in the group.
3. Bot replies with the group chat ID, including negative IDs.
4. User pastes the value exactly and verifies.

### Security Notes

- The function never logs or returns `TELEGRAM_BOT_TOKEN`.
- The browser never receives webhook secret or bot token values.
- Invalid webhook secret tokens return `401`.
- Missing function secrets fail closed with `503`.
- Duplicate Telegram webhook retries may produce duplicate setup replies. This
  is acceptable for a low-frequency chat-ID helper because the reply is
  content-free setup guidance and does not mutate application state.
