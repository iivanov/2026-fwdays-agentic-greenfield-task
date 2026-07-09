import { decryptConfig, getMasterKey } from '../api/crypto.ts';
import { fetchWithSsrfProtection } from '../api/ssrf.ts';
import { assertRpcOk, selectSingle } from './db.ts';
import { DeliveryWorkerError, DeliveryWorkerSkip, getErrorName } from './errors.ts';
import { hmacSha256Hex, sha256Hex } from './crypto-utils.ts';
import type {
  ClaimDeliveryResult,
  DeliveryAttemptRecord,
  DeliveryChannelRecord,
  DeliveryOptions,
  DeliveryResult,
  ProcessedDigestRecord,
  ProcessingFlowRecord,
  StructuredDigest,
  SupabaseAdmin,
} from './types.ts';

const secondsUntil = (isoDate: string | null | undefined): number => {
  if (!isoDate) return 300;
  const ms = new Date(isoDate).getTime();
  if (Number.isNaN(ms)) return 300;
  return Math.min(Math.max(Math.ceil((ms - Date.now()) / 1000), 1), 3600);
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const renderDigestPlainText = (digest: StructuredDigest, flowName: string): string => {
  const lines = [`${digest.title}`, `Flow: ${flowName}`, `Language: ${digest.language}`];
  for (const section of digest.sections) {
    lines.push('', section.heading);
    for (const item of section.items) {
      lines.push(`- ${item.title}`, item.summary);
      if (item.source_urls.length > 0) {
        lines.push(`  Sources: ${item.source_urls.join(', ')}`);
      }
    }
  }
  return lines.join('\n').trim();
};

const renderDigestHtml = (digest: StructuredDigest, flowName: string): string => {
  const sections = digest.sections
    .map((section) => {
      const items = section.items
        .map((item) => {
          const sources = item.source_urls
            .map((url) => `<li><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></li>`)
            .join('');
          return `<li><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.summary)}</p>${
            sources ? `<ul>${sources}</ul>` : ''
          }</li>`;
        })
        .join('');
      return `<h2>${escapeHtml(section.heading)}</h2><ul>${items}</ul>`;
    })
    .join('');

  return `<!doctype html><html><body><h1>${escapeHtml(digest.title)}</h1><p>Flow: ${
    escapeHtml(flowName)
  }</p>${sections}</body></html>`;
};

const splitMessage = (text: string, limit: number): string[] => {
  if (text.length <= limit) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > limit) {
    const paragraphBreak = remaining.lastIndexOf('\n\n', limit);
    const lineBreak = remaining.lastIndexOf('\n', limit);
    const splitAt = paragraphBreak > limit * 0.5
      ? paragraphBreak
      : lineBreak > 0
      ? lineBreak
      : limit;
    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
};

const parseRetryAfterSeconds = (value: string | null): number | null => {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(Math.ceil(seconds), 3600);
  const dateMs = new Date(value).getTime();
  if (Number.isNaN(dateMs)) return null;
  return Math.min(Math.max(Math.ceil((dateMs - Date.now()) / 1000), 0), 3600);
};

const isRetryableDeliveryStatus = (status: number): boolean =>
  status === 408 || status === 425 || status === 429 || status >= 500;

const classifyDeliveryResponse = (response: Response, adapter: string): void => {
  if (response.ok) return;
  const retryable = isRetryableDeliveryStatus(response.status);
  throw new DeliveryWorkerError(
    `${adapter}_http_${response.status}`,
    `${adapter}_http_${response.status}`,
    retryable,
    parseRetryAfterSeconds(response.headers.get('retry-after')),
  );
};

const fetchJsonWithTimeout = async (
  url: string,
  body: Record<string, unknown>,
  options: DeliveryOptions,
  headers: Record<string, string> = {},
): Promise<Response> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 10_000);
  try {
    const fetchImpl = options.fetchImpl ?? fetch;
    return await fetchImpl(url, {
      method: 'POST',
      signal: controller.signal,
      redirect: 'manual',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
    });
  } finally {
    clearTimeout(timeout);
  }
};

const fetchJsonWithSsrfTimeout = async (
  url: string,
  body: Record<string, unknown>,
  options: DeliveryOptions,
  headers: Record<string, string> = {},
): Promise<Response> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 10_000);
  try {
    return await fetchWithSsrfProtection(
      url,
      {
        method: 'POST',
        signal: controller.signal,
        redirect: 'manual',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify(body),
      },
      {
        fetchImpl: options.fetchImpl,
        resolveDns: options.resolveDns,
        followRedirects: false,
      },
    );
  } finally {
    clearTimeout(timeout);
  }
};

const getStringConfig = (
  config: Record<string, unknown>,
  key: string,
  errorCode: string,
): string => {
  const value = config[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new DeliveryWorkerError(errorCode, errorCode, false);
  }
  return value;
};

const getWebhookOriginScopeKey = async (url: string): Promise<string> => {
  const origin = new URL(url).origin.toLowerCase();
  return await sha256Hex(origin);
};

const getDeliveryConfig = async (
  channel: DeliveryChannelRecord,
  options: DeliveryOptions,
): Promise<Record<string, unknown>> => {
  const masterKey = options.masterCryptoKey ?? getMasterKey();
  const decrypted = await decryptConfig(channel.config, masterKey);
  return decrypted && typeof decrypted === 'object' ? decrypted as Record<string, unknown> : {};
};

const loadDeliveryAttemptBundle = async (
  supabaseAdmin: SupabaseAdmin,
  attemptId: string,
): Promise<{
  attempt: DeliveryAttemptRecord;
  channel: DeliveryChannelRecord;
  digest: ProcessedDigestRecord;
  flow: Pick<ProcessingFlowRecord, 'id' | 'name'>;
}> => {
  const attempt = await selectSingle<DeliveryAttemptRecord>(
    supabaseAdmin,
    'digest_delivery_attempts',
    'id,digest_id,channel_id,status',
    { id: attemptId },
  );
  if (!attempt) {
    throw new DeliveryWorkerError('delivery_attempt_not_found', 'delivery_not_found', false);
  }
  if (!attempt.channel_id) {
    throw new DeliveryWorkerError('delivery_channel_missing', 'delivery_channel_missing', false);
  }

  const channel = await selectSingle<DeliveryChannelRecord>(
    supabaseAdmin,
    'delivery_channels',
    'id,user_id,type,status,config',
    { id: attempt.channel_id },
  );
  if (!channel) {
    throw new DeliveryWorkerError('delivery_channel_not_found', 'delivery_channel_missing', false);
  }
  if (channel.status !== 'active') {
    throw new DeliveryWorkerError(
      'delivery_channel_not_active',
      'delivery_channel_not_active',
      false,
    );
  }

  const digest = await selectSingle<ProcessedDigestRecord>(
    supabaseAdmin,
    'processed_digests',
    'id,flow_id,content',
    { id: attempt.digest_id },
  );
  if (!digest) throw new DeliveryWorkerError('digest_not_found', 'digest_not_found', false);

  const flow = await selectSingle<Pick<ProcessingFlowRecord, 'id' | 'name'>>(
    supabaseAdmin,
    'processing_flows',
    'id,name',
    { id: digest.flow_id },
  );
  if (!flow) throw new DeliveryWorkerError('flow_not_found', 'flow_not_found', false);

  return { attempt, channel, digest, flow };
};

const claimDeliveryAttempt = async (supabaseAdmin: SupabaseAdmin, attemptId: string) => {
  const result = assertRpcOk(
    await supabaseAdmin.rpc('claim_delivery_attempt', { p_attempt_id: attemptId }),
    'claim delivery attempt failed',
  ) as ClaimDeliveryResult;

  if (!result.claimed) {
    if (result.status === 'delivered') {
      throw new DeliveryWorkerSkip('delivery_already_completed', 'ack');
    }
    if (result.status === 'pending' || result.status === 'failed' || result.status === 'sending') {
      throw new DeliveryWorkerSkip(
        'delivery_not_due',
        'requeue',
        secondsUntil(result.next_attempt_at),
      );
    }
    throw new DeliveryWorkerError('delivery_not_claimable', 'delivery_not_claimable', false);
  }
};

const assertCircuitAllowsDelivery = async (
  supabaseAdmin: SupabaseAdmin,
  scopeType: string | null,
  scopeKey: string | null,
) => {
  if (!scopeType || !scopeKey) return;
  const result = assertRpcOk(
    await supabaseAdmin.rpc('claim_integration_circuit_probe', {
      p_scope_type: scopeType,
      p_scope_key: scopeKey,
    }),
    'claim integration circuit probe failed',
  ) as { allowed?: boolean };

  if (result.allowed === false) {
    throw new DeliveryWorkerError('delivery_circuit_open', 'delivery_circuit_open', true);
  }
};

const annotateDeliveryError = (error: DeliveryWorkerError, circuit: DeliveryResult) => {
  error.circuitScopeType = circuit.circuitScopeType;
  error.circuitScopeKey = circuit.circuitScopeKey;
  return error;
};

const normalizeDeliveryAdapterError = (
  error: unknown,
  circuit: DeliveryResult,
): DeliveryWorkerError => {
  if (error instanceof DeliveryWorkerError) return annotateDeliveryError(error, circuit);
  const errorName = getErrorName(error);
  if (errorName === 'AbortError') {
    return annotateDeliveryError(
      new DeliveryWorkerError('delivery_timeout', 'delivery_timeout', true),
      circuit,
    );
  }
  if (errorName === 'SsrfProtectionError') {
    return annotateDeliveryError(
      new DeliveryWorkerError('ssrf_blocked', 'ssrf_blocked', false),
      circuit,
    );
  }
  if (error instanceof TypeError) {
    return annotateDeliveryError(
      new DeliveryWorkerError('delivery_transport_failed', 'delivery_transport_failed', true),
      circuit,
    );
  }
  return annotateDeliveryError(
    new DeliveryWorkerError('delivery_adapter_failed', 'delivery_adapter_failed', false),
    circuit,
  );
};

const resolveCircuitScope = async (
  channel: DeliveryChannelRecord,
  config: Record<string, unknown>,
): Promise<DeliveryResult> => {
  if (channel.type === 'email') {
    return { circuitScopeType: 'email_provider', circuitScopeKey: 'brevo' };
  }
  if (channel.type === 'telegram') {
    return { circuitScopeType: 'telegram', circuitScopeKey: 'bot_api' };
  }
  if (channel.type === 'slack') {
    const url = getStringConfig(config, 'webhook_url', 'slack_url_missing');
    return { circuitScopeType: 'slack', circuitScopeKey: await getWebhookOriginScopeKey(url) };
  }
  if (channel.type === 'webhook') {
    const url = getStringConfig(config, 'webhook_url', 'webhook_url_missing');
    return {
      circuitScopeType: 'webhook_origin',
      circuitScopeKey: await getWebhookOriginScopeKey(url),
    };
  }
  return { circuitScopeType: null, circuitScopeKey: null };
};

const deliverEmail = async (
  bundle: Awaited<ReturnType<typeof loadDeliveryAttemptBundle>>,
  config: Record<string, unknown>,
  options: DeliveryOptions,
) => {
  const apiKey = options.brevoApiKey;
  const senderEmail = options.brevoSenderEmail;
  if (!apiKey || !senderEmail) {
    throw new DeliveryWorkerError('brevo_not_configured', 'brevo_not_configured', true);
  }
  const recipient = getStringConfig(config, 'email', 'email_recipient_missing');
  const text = renderDigestPlainText(bundle.digest.content, bundle.flow.name);
  const html = renderDigestHtml(bundle.digest.content, bundle.flow.name);
  const response = await fetchJsonWithTimeout(
    'https://api.brevo.com/v3/smtp/email',
    {
      sender: { email: senderEmail, name: 'News Aggregator' },
      to: [{ email: recipient }],
      subject: bundle.digest.content.title,
      htmlContent: html,
      textContent: text,
    },
    options,
    {
      'api-key': apiKey,
      Accept: 'application/json',
    },
  );
  await classifyDeliveryResponse(response, 'brevo');
};

const deliverTelegram = async (
  bundle: Awaited<ReturnType<typeof loadDeliveryAttemptBundle>>,
  config: Record<string, unknown>,
  options: DeliveryOptions,
) => {
  const botToken = options.telegramBotToken;
  if (!botToken) {
    throw new DeliveryWorkerError(
      'telegram_bot_not_configured',
      'telegram_bot_not_configured',
      true,
    );
  }
  const chatId = getStringConfig(config, 'chat_id', 'telegram_chat_missing');
  const text = renderDigestPlainText(bundle.digest.content, bundle.flow.name);
  for (const chunk of splitMessage(text, 3900)) {
    const response = await fetchJsonWithTimeout(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      { chat_id: chatId, text: chunk, disable_web_page_preview: true },
      options,
    );
    await classifyDeliveryResponse(response, 'telegram');
  }
};

const deliverSlack = async (
  bundle: Awaited<ReturnType<typeof loadDeliveryAttemptBundle>>,
  config: Record<string, unknown>,
  options: DeliveryOptions,
) => {
  const webhookUrl = getStringConfig(config, 'webhook_url', 'slack_url_missing');
  const text = renderDigestPlainText(bundle.digest.content, bundle.flow.name);
  for (const chunk of splitMessage(text, 3500)) {
    const response = await fetchJsonWithSsrfTimeout(webhookUrl, { text: chunk }, options);
    if (response.status >= 300 && response.status < 400) {
      throw new DeliveryWorkerError('slack_redirect_blocked', 'slack_redirect_blocked', false);
    }
    await classifyDeliveryResponse(response, 'slack');
  }
};

const buildWebhookPayload = (
  bundle: Awaited<ReturnType<typeof loadDeliveryAttemptBundle>>,
  timestamp: number,
) => ({
  schema_version: 1,
  event_type: 'digest.delivered',
  event_id: bundle.attempt.id,
  timestamp,
  flow: {
    id: bundle.flow.id,
    name: bundle.flow.name,
  },
  digest: {
    id: bundle.digest.id,
    content: bundle.digest.content,
  },
});

const deliverWebhook = async (
  bundle: Awaited<ReturnType<typeof loadDeliveryAttemptBundle>>,
  config: Record<string, unknown>,
  options: DeliveryOptions,
) => {
  const webhookUrl = getStringConfig(config, 'webhook_url', 'webhook_url_missing');
  const parsedUrl = new URL(webhookUrl);
  if (parsedUrl.protocol !== 'https:') {
    throw new DeliveryWorkerError('webhook_https_required', 'webhook_https_required', false);
  }
  const signingSecret = getStringConfig(config, 'signing_secret', 'webhook_secret_missing');
  const timestamp = Math.floor((options.now?.() ?? new Date()).getTime() / 1000);
  const payload = buildWebhookPayload(bundle, timestamp);
  const rawBody = JSON.stringify(payload);
  const signature = await hmacSha256Hex(signingSecret, `${timestamp}.${rawBody}`);
  const response = await fetchJsonWithSsrfTimeout(
    webhookUrl,
    payload,
    options,
    {
      'X-News-Event-Id': bundle.attempt.id,
      'X-News-Timestamp': String(timestamp),
      'X-News-Signature': `v1=${signature}`,
    },
  );
  if (response.status >= 300 && response.status < 400) {
    throw new DeliveryWorkerError('webhook_redirect_blocked', 'webhook_redirect_blocked', false);
  }
  await classifyDeliveryResponse(response, 'webhook');
};

export async function deliverAttempt(
  supabaseAdmin: SupabaseAdmin,
  attemptId: string,
  options: DeliveryOptions = {},
): Promise<DeliveryResult> {
  await claimDeliveryAttempt(supabaseAdmin, attemptId);
  const bundle = await loadDeliveryAttemptBundle(supabaseAdmin, attemptId);
  const config = await getDeliveryConfig(bundle.channel, options);
  const circuit = await resolveCircuitScope(bundle.channel, config);
  try {
    await assertCircuitAllowsDelivery(
      supabaseAdmin,
      circuit.circuitScopeType,
      circuit.circuitScopeKey,
    );
  } catch (error: unknown) {
    if (error instanceof DeliveryWorkerError) {
      error.circuitScopeType = circuit.circuitScopeType;
      error.circuitScopeKey = circuit.circuitScopeKey;
    }
    throw error;
  }

  try {
    if (bundle.channel.type === 'in-app') return circuit;
    if (bundle.channel.type === 'email') await deliverEmail(bundle, config, options);
    else if (bundle.channel.type === 'telegram') await deliverTelegram(bundle, config, options);
    else if (bundle.channel.type === 'slack') await deliverSlack(bundle, config, options);
    else if (bundle.channel.type === 'webhook') await deliverWebhook(bundle, config, options);
    else {
      throw new DeliveryWorkerError(
        'delivery_channel_unsupported',
        'delivery_channel_unsupported',
        false,
      );
    }
  } catch (error: unknown) {
    throw normalizeDeliveryAdapterError(error, circuit);
  }

  return circuit;
}
