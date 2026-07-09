import {
  type DnsResolver,
  fetchWithSsrfProtection,
  SsrfProtectionError,
  validateUrlSsrf,
} from './ssrf.ts';
import type { AuthenticatedApiUser, ChannelType } from './types.ts';

function isVerifiedEmailUser(user: AuthenticatedApiUser): user is AuthenticatedApiUser & {
  email: string;
} {
  return Boolean(user.email && (user.email_confirmed_at || user.confirmed_at));
}

export function bindDeliveryConfigToIdentity(
  type: ChannelType,
  config: Record<string, unknown>,
  user: AuthenticatedApiUser,
): { success: true; config: Record<string, unknown> } | { success: false; error: string } {
  if (type === 'email') {
    if (!isVerifiedEmailUser(user)) {
      return {
        success: false,
        error: 'Email delivery requires a verified authenticated account email',
      };
    }
    return { success: true, config: { email: user.email } };
  }

  if (type === 'telegram') {
    if ('bot_token' in config) {
      return {
        success: false,
        error: 'Telegram channels use the application-owned bot; do not submit bot tokens',
      };
    }
  }

  return { success: true, config };
}

function getEnv(name: string): string {
  try {
    const globalRecord = globalThis as Record<string, unknown>;
    const anyDeno = globalRecord.Deno as Record<string, unknown> | undefined;
    if (anyDeno && typeof anyDeno.env === 'object' && anyDeno.env !== null) {
      const envRecord = anyDeno.env as Record<string, unknown>;
      if (typeof envRecord.get === 'function') {
        return (envRecord.get(name) as string) || '';
      }
    }
  } catch {
    // ignore
  }

  try {
    if (typeof process !== 'undefined' && process.env) {
      return process.env[name] || '';
    }
  } catch {
    // ignore
  }

  return '';
}

async function fetchWithVerificationTimeout(
  url: string,
  init: RequestInit,
  resolveDns?: DnsResolver,
  timeoutMs = 5000,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchWithSsrfProtection(url, { ...init, signal: controller.signal }, {
      resolveDns,
      followRedirects: false,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function deliveryVerificationFailure(
  error: unknown,
  safetyError: string,
  providerError: string,
): { success: false; error: string } {
  if (error instanceof SsrfProtectionError) {
    return { success: false, error: safetyError };
  }

  return { success: false, error: providerError };
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function signWebhookChallenge(
  secret: string,
  body: string,
  timestamp: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${timestamp}.${body}`),
  );
  return toHex(new Uint8Array(signature));
}

export async function verifyDeliveryChannelTarget(
  type: ChannelType,
  config: Record<string, unknown>,
  resolveDns?: DnsResolver,
): Promise<{ success: true } | { success: false; error: string }> {
  if (type === 'in-app' || type === 'email') {
    return { success: true };
  }

  if (type === 'telegram') {
    const botToken = getEnv('TELEGRAM_BOT_TOKEN');
    const chatId = config.chat_id;
    if (!botToken) {
      return { success: false, error: 'Telegram verification is unavailable' };
    }
    if (!chatId || typeof chatId !== 'string') {
      return { success: false, error: 'Telegram chat ID is missing' };
    }
    const response = await fetchWithVerificationTimeout(
      `https://api.telegram.org/bot${botToken}/getChat?chat_id=${encodeURIComponent(chatId)}`,
      { method: 'GET' },
      resolveDns,
    );
    if (!response.ok) {
      return { success: false, error: 'Telegram chat verification failed' };
    }
    return { success: true };
  }

  if (type === 'slack') {
    const webhookUrl = config.webhook_url;
    if (!webhookUrl || typeof webhookUrl !== 'string') {
      return { success: false, error: 'Slack webhook URL is missing' };
    }
    const isSafe = await validateUrlSsrf(webhookUrl, resolveDns);
    if (!isSafe) {
      return { success: false, error: 'Slack webhook URL failed outbound safety validation' };
    }
    let response: Response;
    try {
      response = await fetchWithVerificationTimeout(
        webhookUrl,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: 'AI News Aggregator delivery channel verification.' }),
        },
        resolveDns,
      );
    } catch (error) {
      return deliveryVerificationFailure(
        error,
        'Slack webhook URL failed outbound safety validation',
        'Slack webhook verification failed',
      );
    }
    if (!response.ok) {
      return { success: false, error: 'Slack webhook verification failed' };
    }
    return { success: true };
  }

  if (type === 'webhook') {
    const webhookUrl = config.webhook_url;
    const signingSecret = config.signing_secret;
    if (!webhookUrl || typeof webhookUrl !== 'string') {
      return { success: false, error: 'Webhook URL is missing' };
    }
    if (!signingSecret || typeof signingSecret !== 'string') {
      return { success: false, error: 'Webhook signing secret is missing' };
    }
    const isSafe = await validateUrlSsrf(webhookUrl, resolveDns);
    if (!isSafe) {
      return { success: false, error: 'Webhook URL failed outbound safety validation' };
    }
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const body = JSON.stringify({
      type: 'delivery_channel.verify',
      timestamp,
    });
    const signature = await signWebhookChallenge(signingSecret, body, timestamp);
    let response: Response;
    try {
      response = await fetchWithVerificationTimeout(
        webhookUrl,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-News-Aggregator-Event': 'delivery_channel.verify',
            'X-News-Aggregator-Timestamp': timestamp,
            'X-News-Aggregator-Signature': `sha256=${signature}`,
          },
          body,
        },
        resolveDns,
      );
    } catch (error) {
      return deliveryVerificationFailure(
        error,
        'Webhook URL failed outbound safety validation',
        'Webhook challenge verification failed',
      );
    }
    if (!response.ok) {
      return { success: false, error: 'Webhook challenge verification failed' };
    }
    return { success: true };
  }

  return { success: false, error: 'Unsupported delivery channel type' };
}

// -----------------------------------------------------------------------------
// Delivery Channels Helper Functions
// -----------------------------------------------------------------------------

export function generateSigningSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function validateChannelConfig(
  type: string,
  config: Record<string, unknown>,
): { success: boolean; error?: string } {
  if (!config || typeof config !== 'object') {
    return { success: false, error: 'Config must be an object' };
  }

  if (type === 'email') {
    const email = config.email;
    if (!email || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email)) {
      return { success: false, error: 'Config must contain a valid email address' };
    }
  } else if (type === 'telegram') {
    if (!config.chat_id || typeof config.chat_id !== 'string') {
      return { success: false, error: 'Config must contain chat_id string' };
    }
    if ('bot_token' in config) {
      return {
        success: false,
        error: 'Config must not contain bot_token; Telegram uses the application-owned bot',
      };
    }
  } else if (type === 'slack') {
    const url = config.webhook_url;
    if (!url || typeof url !== 'string' || !/^https:\/\/hooks\.slack\.com\/services\//.test(url)) {
      return { success: false, error: 'Config must contain a valid Slack webhook URL' };
    }
  } else if (type === 'webhook') {
    const url = config.webhook_url;
    if (!url || typeof url !== 'string') {
      return { success: false, error: 'Config must contain webhook_url string' };
    }
    try {
      new URL(url);
    } catch {
      return { success: false, error: 'Invalid webhook URL format' };
    }
  }

  return { success: true };
}
