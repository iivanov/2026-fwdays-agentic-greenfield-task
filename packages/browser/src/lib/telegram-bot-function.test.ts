import { describe, expect, it, vi } from 'vitest';
import {
  buildChatIdReply,
  createTelegramBotHandler,
} from '../../../../supabase/functions/telegram-bot/index.ts';

describe('telegram chat id bot function', () => {
  it('rejects webhook calls without the configured Telegram secret token', async () => {
    const handler = createTelegramBotHandler({
      botToken: '123456:app-owned-token',
      webhookSecret: 'expected-secret',
    });

    const response = await handler(
      new Request('https://example.test/functions/v1/telegram-bot', {
        method: 'POST',
        headers: { 'X-Telegram-Bot-Api-Secret-Token': 'wrong-secret' },
        body: JSON.stringify({ message: { chat: { id: 123456 } } }),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ ok: false, error: 'unauthorized' });
  });

  it('replies to Telegram messages with the chat id and dashboard instructions', async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    const handler = createTelegramBotHandler({
      botToken: '123456:app-owned-token',
      webhookSecret: 'expected-secret',
      fetchImpl,
    });

    const response = await handler(
      new Request('https://example.test/functions/v1/telegram-bot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Bot-Api-Secret-Token': 'expected-secret',
        },
        body: JSON.stringify({
          message: {
            chat: { id: -1001234567890, title: 'Editorial desk', type: 'supergroup' },
            from: { is_bot: false },
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, chat_id: '-1001234567890' });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.telegram.org/bot123456%3Aapp-owned-token/sendMessage',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({
      chat_id: '-1001234567890',
      disable_web_page_preview: true,
    });
    expect(body.text).toContain('-1001234567890');
    expect(body.text).toContain('Delivery -> Telegram Chat ID');
    expect(body.text).toContain('@news_desk_ai_bot');
    expect(body.text).not.toContain('123456:app-owned-token');
  });

  it('builds a direct chat id reply without exposing tokens', () => {
    const text = buildChatIdReply({ id: 987654321 });

    expect(text).toContain('987654321');
    expect(text).toContain('Do not paste the bot token into the dashboard');
    expect(text).not.toContain('TELEGRAM_BOT_TOKEN=');
  });
});
