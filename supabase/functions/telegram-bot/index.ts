/// <reference types="@supabase/functions-js/edge-runtime.d.ts" />

type FetchLike = typeof fetch;

type TelegramChat = {
  id?: number | string;
  title?: string;
  username?: string;
  type?: string;
};

type TelegramMessage = {
  chat?: TelegramChat;
  from?: {
    is_bot?: boolean;
  };
};

type TelegramUpdate = {
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
  edited_channel_post?: TelegramMessage;
};

type TelegramBotHandlerOptions = {
  botToken?: string;
  webhookSecret?: string;
  fetchImpl?: FetchLike;
};

const BOT_USERNAME = 'news_desk_ai_bot';
const BOT_HANDLE = `@${BOT_USERNAME}`;
const TELEGRAM_SECRET_HEADER = 'x-telegram-bot-api-secret-token';

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const getEnv = (name: string) =>
  typeof Deno === 'undefined' ? undefined : Deno.env.get(name) || undefined;

const constantTimeEqual = (left: string, right: string) => {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  let diff = leftBytes.length ^ rightBytes.length;
  const maxLength = Math.max(leftBytes.length, rightBytes.length);
  for (let index = 0; index < maxLength; index += 1) {
    diff |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return diff === 0;
};

const extractMessage = (update: TelegramUpdate): TelegramMessage | null =>
  update.message ?? update.edited_message ?? update.channel_post ?? update.edited_channel_post ??
    null;

export const buildChatIdReply = (chat: TelegramChat) => {
  const chatId = String(chat.id ?? '');
  const title = typeof chat.title === 'string' && chat.title.trim() ? ` for ${chat.title}` : '';
  return [
    `News Desk chat ID${title}`,
    '',
    chatId,
    '',
    'Paste this value into News Personalization -> Delivery -> Telegram Chat ID.',
    'Then click Add delivery channel and Verify Link.',
    '',
    `This bot is ${BOT_HANDLE}. Do not paste the bot token into the dashboard.`,
  ].join('\n');
};

const sendMessage = async (
  botToken: string,
  chatId: string,
  text: string,
  fetchImpl: FetchLike,
) => {
  const response = await fetchImpl(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
    },
  );
  if (!response.ok) {
    throw new Error('telegram_send_failed');
  }
};

export const createTelegramBotHandler =
  (options: TelegramBotHandlerOptions = {}) => async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') {
      return new Response('ok');
    }
    if (req.method !== 'POST') {
      return json({ ok: false, error: 'method_not_allowed' }, 405);
    }

    const webhookSecret = options.webhookSecret ?? getEnv('TELEGRAM_WEBHOOK_SECRET');
    if (!webhookSecret) {
      return json({ ok: false, error: 'telegram_webhook_secret_not_configured' }, 503);
    }
    const providedSecret = req.headers.get(TELEGRAM_SECRET_HEADER) ?? '';
    if (!constantTimeEqual(providedSecret, webhookSecret)) {
      return json({ ok: false, error: 'unauthorized' }, 401);
    }

    const botToken = options.botToken ?? getEnv('TELEGRAM_BOT_TOKEN');
    if (!botToken) {
      return json({ ok: false, error: 'telegram_bot_not_configured' }, 503);
    }

    let update: TelegramUpdate;
    try {
      update = (await req.json()) as TelegramUpdate;
    } catch {
      return json({ ok: false, error: 'invalid_json' }, 400);
    }

    const message = extractMessage(update);
    const chat = message?.chat;
    if (!chat?.id || message?.from?.is_bot === true) {
      return json({ ok: true, ignored: true });
    }

    const chatId = String(chat.id);
    const fetchImpl = options.fetchImpl ?? fetch;
    try {
      await sendMessage(botToken, chatId, buildChatIdReply(chat), fetchImpl);
    } catch {
      return json({ ok: false, error: 'telegram_send_failed' }, 502);
    }

    return json({ ok: true, chat_id: chatId });
  };

export default {
  fetch: createTelegramBotHandler(),
};
