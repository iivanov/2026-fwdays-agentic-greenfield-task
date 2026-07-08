# Deployment Setup Guide for Non-Technical Operators

Last checked against provider documentation: 2026-07-06.

This guide explains how to make the AI News Desk app live on the internet. It is written for a non-technical person who can create accounts, copy keys, and paste them into the right settings pages.

You should not paste real tokens into this document, GitHub code, issues, pull requests, chat, screenshots, or email. Store them only in the provider settings screens named below.

## 1. What You Are Setting Up

The app uses these services:

| Service | What it does | Cost target |
| --- | --- | --- |
| GitHub | Stores the project code and runs checks | Free for this public repository |
| Vercel | Hosts the website users open in the browser | Hobby plan |
| Supabase | Hosts the database, login, API, background jobs, cron, and secret storage | Free plan |
| OpenAI | Creates AI summaries and digests | Usage billed |
| Brevo | Sends email digests and operator alerts | Free allowance, then paid if exceeded |
| Google OAuth | Lets users sign in with Google | Free |
| GitHub OAuth | Lets users sign in with GitHub | Free |
| Telegram BotFather | Creates the app Telegram bot token | Free |
| Slack webhooks | User-owned delivery targets | Optional, usually configured by users later |

Vercel only hosts the static website, including the public landing page and the
authenticated browser dashboard shell. Supabase runs the backend work. Do not
set up Vercel Functions or Vercel Cron for this project.

## 2. Golden Rules for Tokens

1. Never commit a real token, API key, password, or `.env` file to GitHub.
2. Only these two values are safe to place in Vercel browser environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Keep these secret. They must never be exposed in the browser:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `OPENAI_API_KEY`
   - `BREVO_API_KEY`
   - `TELEGRAM_BOT_TOKEN`
   - Google and GitHub OAuth client secrets
   - encryption keys and scheduler secrets
4. If you accidentally expose a secret, rotate it in the provider dashboard. Deleting it from code later is not enough.

## 3. Accounts You Need

Create or confirm access to these accounts before starting:

| Account | Where to go |
| --- | --- |
| GitHub | https://github.com |
| Vercel | https://vercel.com |
| Supabase | https://supabase.com/dashboard |
| Google Cloud | https://console.cloud.google.com |
| OpenAI Platform | https://platform.openai.com |
| Brevo | https://app.brevo.com |
| Telegram | Telegram app, then chat with `@BotFather` |
| Slack | Your Slack workspace, only if Slack delivery is needed |

Use a password manager. Give the project owner access to the accounts and recovery email addresses.

## 4. Create the Supabase Project

1. Go to https://supabase.com/dashboard.
2. Click **New project**.
3. Choose the Free plan if the project is still within the documented zero-cost scope.
4. Choose a region close to the expected users.
5. Save the project password in a password manager.
6. Wait until the project is ready.

After the project exists:

1. Open the Supabase project.
2. Go to **Project Settings**.
3. Open **API Keys** or the **Connect** dialog.
4. Copy these values:

| Supabase screen value | Put it here | Notes |
| --- | --- | --- |
| Project URL | `SUPABASE_URL` and `VITE_SUPABASE_URL` | Looks like `https://...supabase.co`. |
| Publishable key or legacy `anon` key | `SUPABASE_ANON_KEY` and `VITE_SUPABASE_ANON_KEY` | This is the browser-safe key. Supabase now recommends publishable keys; the repo variable name still says `ANON_KEY`. |
| Legacy `service_role` key | `SUPABASE_SERVICE_ROLE_KEY` | Secret. Backend only. Do not place it in Vercel browser variables. |

Supabase also offers newer secret keys. For this codebase, keep the legacy `service_role` value available as `SUPABASE_SERVICE_ROLE_KEY` because the Edge Functions currently read that name.

## 5. Configure Supabase Auth

### 5.1 Set the App URL

You will not know the final Vercel URL until after the Vercel project is created. Come back to this step after Vercel gives you a production URL.

In Supabase:

1. Open **Authentication**.
2. Open **URL Configuration**.
3. Set **Site URL** to the Vercel production URL, for example:
   - `https://your-project.vercel.app`
4. Add redirect URLs:
   - `https://your-project.vercel.app/auth/callback`
   - `http://127.0.0.1:5180/auth/callback` for local testing if needed
   - `http://localhost:5180/auth/callback` for local testing if needed

If you later add a custom domain, add that domain here too. The current API CORS allowlist accepts `*.vercel.app` and local development origins. A custom production domain may require a code/config update before API calls work from that domain.

### 5.2 Disable Email/Password Signup for Production

In Supabase:

1. Open **Authentication**.
2. Open **Providers**.
3. Keep Google and GitHub enabled after you configure them.
4. Disable public email/password signup for production unless the product owner explicitly decides otherwise.

Local development may still use email/password for testing.

## 6. Create Google Login

1. Go to https://console.cloud.google.com.
2. Create or select a Google Cloud project.
3. Open **APIs & Services**.
4. Open **OAuth consent screen** or **Google Auth Platform**.
5. Configure the app name, support email, and developer contact email.
6. Add the basic scopes:
   - `openid`
   - email
   - profile
7. Open **Credentials**.
8. Click **Create Credentials**.
9. Choose **OAuth client ID**.
10. Choose **Web application**.
11. Add the Vercel production URL as an authorized JavaScript origin:
    - `https://your-project.vercel.app`
12. In Supabase, open **Authentication > Providers > Google** and copy the callback URL shown there.
13. Paste that callback URL into Google as an authorized redirect URI.
14. Save.
15. Copy the Google **Client ID** and **Client Secret**.
16. Paste them into Supabase under **Authentication > Providers > Google**.
17. Enable the Google provider in Supabase.

For local development, the callback URL may be `http://127.0.0.1:54321/auth/v1/callback`. Use the exact value Supabase shows.

## 7. Create GitHub Login

1. Go to https://github.com.
2. Open your user menu.
3. Open **Settings**.
4. Open **Developer settings**.
5. Open **OAuth Apps**.
6. Click **New OAuth App**.
7. Set **Application name** to the app name, for example `AI News Desk`.
8. Set **Homepage URL** to the Vercel production URL:
   - `https://your-project.vercel.app`
9. In Supabase, open **Authentication > Providers > GitHub** and copy the callback URL shown there.
10. Paste that callback URL into GitHub as **Authorization callback URL**.
11. Leave device flow disabled.
12. Create the app.
13. Copy the GitHub **Client ID** and generate/copy the **Client Secret**.
14. Paste them into Supabase under **Authentication > Providers > GitHub**.
15. Enable the GitHub provider in Supabase.

## 8. Create the OpenAI API Key

1. Go to https://platform.openai.com/api-keys.
2. Sign in.
3. Create a new API key for this project.
4. Copy it once and store it in the password manager.
5. Put it in Supabase Edge Function secrets as:
   - `OPENAI_API_KEY`

Also choose budget values:

| Name | Suggested starting value | What it means |
| --- | --- | --- |
| `AI_DAILY_TOKEN_BUDGET` | `100000` | Daily token ceiling before workers stop spending. Adjust after real usage is known. |
| `AI_RESPONSE_TOKEN_BUDGET` | `12000` | Per-response ceiling. Adjust after digest quality is reviewed. |

These are guardrails, not billing limits. Also set billing limits or alerts in the OpenAI account.

## 9. Create the Brevo Email Key

1. Go to https://app.brevo.com.
2. Verify the sender email address or sender domain you want the app to use.
3. Open account/API settings.
4. Create an API key for this project.
5. Copy it once and store it in the password manager.
6. Put these values in Supabase Edge Function secrets:

| Name | Value |
| --- | --- |
| `BREVO_API_KEY` | The Brevo API key |
| `BREVO_SENDER_EMAIL` | The verified sender email address |
| `OPERATOR_ALERT_EMAIL` | The project owner's alert email address |

If email delivery fails, first confirm the sender email/domain is verified in Brevo.

## 10. Create the Telegram Bot Token

1. Open Telegram.
2. Search for `@BotFather`.
3. Start a chat.
4. Send `/newbot`.
5. Follow the prompts to choose the bot name and username. The current production bot shown in the app is `@news_desk_ai_bot`.
6. Copy the token BotFather gives you.
7. Store it in the password manager.
8. Put it in Supabase Edge Function secrets as:
   - `TELEGRAM_BOT_TOKEN`

Do not paste this token into Vercel.

Create one additional random secret for Telegram webhook verification:

| Name | Purpose | How to create it |
| --- | --- | --- |
| `TELEGRAM_WEBHOOK_SECRET` | Proves incoming bot webhook calls came through the Telegram webhook you configured | Use 32-64 random characters using only `A-Z`, `a-z`, `0-9`, `_`, and `-`. Do not use spaces or other symbols. |

Put `TELEGRAM_WEBHOOK_SECRET` in Supabase Edge Function secrets too.

Telegram accepts `setWebhook.secret_token` values from 1 to 256 characters, but only these characters are valid: letters, digits, underscore, and hyphen. If your password manager can generate a custom password, disable symbols except `_` and `-`.

After the `telegram-bot` Supabase function is deployed, register the Telegram webhook. Replace `TOKEN`, `PROJECT_REF`, and `WEBHOOK_SECRET` with real values from the password manager and Supabase project:

```bash
curl -X POST "https://api.telegram.org/botTOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://PROJECT_REF.supabase.co/functions/v1/telegram-bot",
    "secret_token": "WEBHOOK_SECRET",
    "allowed_updates": ["message", "edited_message", "channel_post", "edited_channel_post"]
  }'
```

### 10.1 Get a Telegram Chat ID for Delivery Testing

The app sends Telegram messages through the project bot `@news_desk_ai_bot`.
The dashboard asks for a chat ID only; it must never ask for the bot token.

For a direct chat:

1. Open `https://t.me/news_desk_ai_bot`.
2. Press **Start**, or send any short message such as `hello`.
3. The bot replies with the chat ID and tells you where to paste it.
4. Paste that number into the dashboard Telegram Chat ID field.

For a group chat:

1. Add `@news_desk_ai_bot` to the group.
2. Send a message in the group. If the bot does not appear in updates, mention it directly, for example `@news_desk_ai_bot hello`.
3. The bot replies with the group chat ID. Group and supergroup IDs are often negative.
4. Paste that value exactly as returned into the dashboard Telegram Chat ID field.

Then use **Verify Link** in the dashboard. A successful verification means the app-owned bot can send to that chat.

If the bot does not reply, check that the `telegram-bot` Supabase function is deployed, `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET` are set in Supabase secrets, and the Telegram webhook URL points at the current Supabase project.

## 11. Create App Secrets

The app needs two random secrets that are not copied from a provider.

| Name | Purpose | How to create it |
| --- | --- | --- |
| `ENCRYPTION_MASTER_KEY` | Protects stored delivery secrets | Ask a technical helper to create a base64 32-byte key. |
| `MASTER_CRYPTO_KEY` | Runtime name currently read by the Edge Functions | Use the same value as `ENCRYPTION_MASTER_KEY`. |
| `SCHEDULER_SECRET` | Reserved scheduler/ops secret | Use a long random password from a password manager. |

Ask a technical helper to generate the encryption key with:

```bash
openssl rand -base64 32
```

Store the generated value in the password manager and add it to Supabase Edge Function secrets under both `ENCRYPTION_MASTER_KEY` and `MASTER_CRYPTO_KEY`. The `.env.example` file lists `ENCRYPTION_MASTER_KEY`; the current deployed runtime code reads `MASTER_CRYPTO_KEY`.

## 12. Put Backend Secrets into Supabase

In Supabase:

1. Open the project.
2. Open **Edge Functions**.
3. Open **Secrets**.
4. Add each secret below.

| Secret name | Put this value here |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Legacy Supabase `service_role` key |
| `OPENAI_API_KEY` | OpenAI API key |
| `AI_DAILY_TOKEN_BUDGET` | Chosen daily budget number |
| `AI_RESPONSE_TOKEN_BUDGET` | Chosen response budget number |
| `BREVO_API_KEY` | Brevo API key |
| `BREVO_SENDER_EMAIL` | Verified Brevo sender email |
| `OPERATOR_ALERT_EMAIL` | Owner alert email |
| `TELEGRAM_BOT_TOKEN` | Telegram BotFather token |
| `TELEGRAM_WEBHOOK_SECRET` | Random secret also used as Telegram `setWebhook.secret_token` |
| `ENCRYPTION_MASTER_KEY` | Generated encryption key |
| `MASTER_CRYPTO_KEY` | Same generated encryption key |
| `SCHEDULER_SECRET` | Generated random scheduler secret |

Supabase hosted Edge Functions usually provide some Supabase values automatically. Adding `SUPABASE_SERVICE_ROLE_KEY` explicitly is still useful for this project because the code reads that exact name.

## 13. Create the Vercel Website

1. Go to https://vercel.com.
2. Click **Add New**.
3. Choose **Project**.
4. Import the GitHub repository.
5. Choose the Hobby plan if this remains a personal/non-commercial deployment.
6. Vercel should read `vercel.json` automatically.
7. If Vercel asks for settings, use:

| Vercel setting | Value |
| --- | --- |
| Root directory | Leave blank or use the repository root. Do not choose `packages/browser`. |
| Framework | Vite |
| Install command | `npm ci` |
| Build command | `npm run build --workspace @news-aggregator/browser` |
| Output directory | `packages/browser/dist` |

8. Before deploying, open **Environment Variables**.
9. Add only these browser-safe values:

| Vercel variable | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase publishable key or legacy `anon` key |

10. Select **Production** for both variables.
11. Add them to **Preview** too if you want Vercel preview deployments to work.
12. Click **Deploy**.

After Vercel finishes, copy the production URL and return to Supabase Auth URL configuration.

## 14. GitHub Secrets for Deployment Automation

The current repository has GitHub Actions checks, but it does not currently include a complete production deployment workflow. That means GitHub can verify the project, but a technical helper must either connect Supabase's GitHub integration or add a protected deploy workflow before production deploys are fully automatic.

If a technical helper adds or enables GitHub-based Supabase deployment, they may need these GitHub secrets:

| GitHub secret | Where to get it |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Supabase account settings, access tokens |
| `SUPABASE_PROJECT_REF` | Supabase project reference, visible in project settings or the project URL |
| `SUPABASE_DB_PASSWORD` | The database password saved when the Supabase project was created |

To add GitHub secrets:

1. Go to the GitHub repository.
2. Open **Settings**.
3. Open **Secrets and variables**.
4. Open **Actions**.
5. Click **New repository secret** or add them to a protected production environment if a deployment workflow uses environments.
6. Paste only the requested secret value.

Do not add OpenAI, Brevo, Telegram, or Supabase service-role secrets to GitHub unless a specific workflow needs them. Prefer Supabase Edge Function secrets for runtime backend secrets.

## 15. Deploy the Supabase Backend

Supabase needs database migrations and Edge Functions deployed. There are two acceptable paths.

### Option A: Supabase GitHub Integration

Use this if you want the simplest provider-managed setup.

1. In Supabase, open the project.
2. Find the GitHub integration or deployment settings.
3. Connect the GitHub repository.
4. Choose `main` as the production branch.
5. Let Supabase deploy from `main`.

Supabase documentation says the GitHub deployment path works on all plans. Branch preview environments require a paid plan.

If the Edge Functions page stays empty after connecting GitHub, confirm that:

1. **Deploy to production** is enabled in the Supabase GitHub integration.
2. The production branch is `main`.
3. The working directory is the repository root.
4. `supabase/config.toml` includes entries for `api`, `schedule-daily`, `work`, `cleanup`, and `telegram-bot`.
5. The Supabase preview check does not report invalid config keys. This repo uses `[inbucket]` for local email testing; `[local_smtp]` is not accepted by the hosted parser.

### Option B: Technical Helper Runs the Supabase CLI

Use this if you do not want to connect Supabase directly to GitHub yet.

The technical helper signs in, links the project, applies the database changes, and deploys functions:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase functions deploy
```

For hosted cron, the database also needs runtime settings for the public project
URL and service-role authorization header. In the Supabase SQL Editor, set them
without pasting the values anywhere public:

```sql
alter database postgres
set app.settings.supabase_url = 'https://your-project-ref.supabase.co';

alter database postgres
set app.settings.scheduler_secret = 'YOUR_SCHEDULER_SECRET';

alter database postgres
set app.settings.service_role_key = 'YOUR_SUPABASE_SERVICE_ROLE_KEY';

select pg_reload_conf();
```

Use the real Project URL, generated `SCHEDULER_SECRET`, and legacy
`service_role` key. Cron sends `SCHEDULER_SECRET` when it calls
`schedule-daily`, `work`, and `cleanup`; the functions use the service-role key
internally for database access. Do not put either secret in Vercel or frontend
code.

To manually invoke the daily scheduler after deployment:

```bash
curl -i -X POST "https://your-project-ref.supabase.co/functions/v1/schedule-daily" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SCHEDULER_SECRET" \
  -d '{}'
```

That normal call only enqueues flows whose `next_run_at` is already due. For an
operator smoke test before the scheduled time, use an explicit forced run:

```bash
curl -i -X POST "https://your-project-ref.supabase.co/functions/v1/schedule-daily" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SCHEDULER_SECRET" \
  -d '{"force":true}'
```

If the response says `jobs_enqueued` is `0`, check the diagnostic fields:
`active_flows`, `due_flows`, `skipped_not_due`, `skipped_existing_cycle`, and
`next_due_at`. If `skipped_existing_cycle` is greater than `0`, the scheduler
found that a run row already existed for that cycle; forced mode still
re-creates missing source work unless the source run is already completed or
currently processing.

The functions that must exist for this app include:

| Function | Purpose |
| --- | --- |
| `api` | Browser API |
| `schedule-daily` | Daily queue scheduling |
| `work` | Background worker for fetching, AI processing, and delivery |
| `cleanup` | Retention and recovery cleanup |

If the browser shows `Function not found`, the Supabase Edge Functions were not deployed or the project URL is wrong.

## 16. Final Deployment Order

Follow this order to avoid confusing errors:

1. Create the Supabase project.
2. Copy Supabase URL and keys.
3. Create Google and GitHub OAuth apps.
4. Configure Google and GitHub providers in Supabase.
5. Create OpenAI, Brevo, Telegram, encryption, and scheduler secrets.
6. Add backend secrets in Supabase Edge Functions.
7. Deploy Supabase database migrations and Edge Functions.
8. Create the Vercel project from GitHub.
9. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel.
10. Deploy the Vercel website.
11. Copy the Vercel production URL into Supabase Auth Site URL and Redirect URLs.
12. Redeploy Vercel if environment variables changed after the first deploy.
13. Run the smoke test checklist below.

## 17. Smoke Test Checklist

After deployment, test the live site in a normal browser window:

1. Open the Vercel URL.
2. Sign in with Google.
3. Sign out.
4. Sign in with GitHub.
5. Open the dashboard.
6. Confirm the Preferences page loads without an error.
7. Add or confirm a news source.
8. Add or confirm a digest flow.
9. Ask a technical helper to manually invoke the daily scheduler or worker once.
10. Confirm a digest appears in the Digests page.
11. If email is enabled, confirm a test email arrives.
12. If Telegram is enabled, confirm a test Telegram delivery works.
13. Check Supabase logs for errors after the test.

## 18. Common Problems

| Symptom | Likely cause | What to check |
| --- | --- | --- |
| `Function not found` | Supabase functions were not deployed | Deploy `api`, `schedule-daily`, `work`, and `cleanup`. |
| Login redirects to the wrong place | Supabase redirect URLs are missing | Add the Vercel URL and `/auth/callback` in Supabase Auth URL settings. |
| Preferences page says profile cannot load | Wrong Supabase URL/key or API function not deployed | Check Vercel env vars and Supabase function deployment. |
| Vercel says `tsc: command not found` | Vercel is building from `packages/browser` instead of the repository root | Set the Vercel project root directory to the repository root, then redeploy. |
| Cron says `schema "net" does not exist` | The hosted database has not applied the migration that enables `pg_net` | Apply migrations from `main`, then confirm `pg_net` exists in `pg_extension`. |
| Cron tries `http://kong:8000` in production | Hosted cron settings were not repaired or `app.settings.supabase_url` is missing | Apply migrations and set `app.settings.supabase_url` to the hosted Supabase Project URL. |
| Encryption key error | Missing runtime encryption key | Add the same value under `ENCRYPTION_MASTER_KEY` and `MASTER_CRYPTO_KEY`. |
| No digest is created | Worker/cron not deployed, no source/flow, or missing OpenAI key | Check Supabase functions, secrets, and logs. |
| Email does not send | Brevo key or sender is wrong | Check `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, and sender verification. |
| Telegram bot does not reply with a chat ID | Webhook not registered, `telegram-bot` function not deployed, or webhook secret mismatch | Check `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_BOT_TOKEN`, the Telegram `setWebhook` URL, and Supabase function logs. |
| Telegram digest delivery does not send | Bot token is wrong, chat ID is wrong, user has not started the bot, or group removed the bot | Check `TELEGRAM_BOT_TOKEN`, verify the channel again, and send a fresh message to `@news_desk_ai_bot` to confirm the chat ID. |
| Custom domain cannot call API | API CORS allowlist does not include it | Ask a technical helper to update the allowed origin and redeploy functions. |

## 19. What Not To Do

Do not:

1. Put `SUPABASE_SERVICE_ROLE_KEY` in Vercel.
2. Put OpenAI, Brevo, Telegram, OAuth client secrets, or encryption keys in Vercel browser variables.
3. Commit `.env`, `.env.local`, `.vercel/`, `supabase/.temp/`, database dumps, or screenshots containing secrets.
4. Enable Vercel Cron or Vercel Functions for this app.
5. Assume GitHub Actions deploys production until a deploy workflow or Supabase GitHub integration is explicitly configured.
6. Use a custom domain without checking Supabase Auth URLs and API allowed origins.

## 20. Official Reference Links

Use these provider pages if a dashboard label changes:

- Supabase deployment: https://supabase.com/docs/guides/deployment
- Supabase API keys: https://supabase.com/docs/guides/getting-started/api-keys
- Supabase Edge Function secrets: https://supabase.com/docs/guides/functions/secrets
- Supabase Edge Function deployment: https://supabase.com/docs/guides/functions/deploy
- Supabase Google login: https://supabase.com/docs/guides/auth/social-login/auth-google
- Supabase GitHub login: https://supabase.com/docs/guides/auth/social-login/auth-github
- Vercel environment variables: https://vercel.com/docs/environment-variables
- GitHub Actions secrets: https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets
- GitHub OAuth app setup: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app
- OpenAI API keys: https://platform.openai.com/api-keys
- Brevo API keys: https://help.brevo.com/hc/en-us/articles/209467465-Create-or-delete-an-API-key
- Telegram BotFather: https://core.telegram.org/bots/features#botfather
- Slack incoming webhooks: https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks/
