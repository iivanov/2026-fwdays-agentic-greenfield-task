/// <reference types="@supabase/functions-js/edge-runtime.d.ts" />
import { withSupabase } from '@supabase/server';
import { createClient } from '@supabase/supabase-js';
import { XMLParser } from 'fast-xml-parser';
import { parseHTML } from 'linkedom';
import { Readability } from '@mozilla/readability';
import { decryptConfig, decryptPromptTemplate, getMasterKey } from '../api/crypto.ts';
import { type DnsResolver, type FetchLike, fetchWithSsrfProtection } from '../api/ssrf.ts';

interface JobPayload {
  type?: string;
  source_id?: string;
  flow_id?: string;
  attempt_id?: string;
  cycle_date?: string;
  simulate_failure?: boolean;
}

interface JobMessage {
  msg_id: string | number;
  read_ct: number;
  enqueued_at: string;
  message: JobPayload;
}

type RpcResult<T = unknown> = { data: T; error: { message: string } | null };

type QueryBuilder = {
  eq: (column: string, value: string) => QueryBuilder;
  order?: (
    column: string,
    options?: { ascending?: boolean; nullsFirst?: boolean },
  ) => QueryBuilder;
  limit?: (count: number) => QueryBuilder;
  maybeSingle?: <T = unknown>() => Promise<{ data: T | null; error: { message: string } | null }>;
  then: <TResult1 = { data?: unknown; error: { message: string } | null }, TResult2 = never>(
    onfulfilled?:
      | ((
        value: { data?: unknown; error: { message: string } | null },
      ) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) => PromiseLike<TResult1 | TResult2>;
};

type SupabaseAdmin = {
  rpc: (name: string, args?: Record<string, unknown>) => Promise<RpcResult>;
  from: (table: string) => {
    select?: (columns?: string) => QueryBuilder;
    insert?: (payload: Record<string, unknown> | Record<string, unknown>[]) => QueryBuilder;
    update: (patch: Record<string, unknown>) => QueryBuilder;
  };
};

type WorkerKind = 'ingestion' | 'processing' | 'delivery';

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const getWorkerKind = (queueName: string, message: JobPayload): WorkerKind | null => {
  if (queueName === 'ingestion-queue' || message.type === 'ingestion') return 'ingestion';
  if (queueName === 'processing-queue' || message.type === 'processing') return 'processing';
  if (queueName === 'delivery-queue' || message.type === 'delivery') return 'delivery';
  return null;
};

const sanitizeDlqContext = (queue: string, message: JobPayload) => ({
  queue,
  type: message.type ?? null,
  source_id: message.source_id ?? null,
  flow_id: message.flow_id ?? null,
  attempt_id: message.attempt_id ?? null,
  cycle_date: message.cycle_date ?? null,
});

const assertRpcOk = <T>(result: { data: T; error: { message: string } | null }, label: string) => {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }
  return result.data;
};

type SourceRecord = {
  id: string;
  url: string;
  type: 'rss' | 'atom' | 'web';
  status?: string | null;
  failed_fetch_count?: number | null;
};

export type ParsedFeedItem = {
  title: string;
  description: string;
  url: string;
  publishedAt: string | null;
  externalGuid: string | null;
};

type IngestedArticle = {
  external_guid: string | null;
  title: string;
  url: string;
  content: string;
  published_at: string | null;
};

type IngestionOptions = {
  fetchImpl?: FetchLike;
  resolveDns?: DnsResolver;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
};

type ProcessingOptions = {
  fetchImpl?: FetchLike;
  openAiApiKey?: string;
  timeoutMs?: number;
};

type DeliveryOptions = {
  fetchImpl?: FetchLike;
  resolveDns?: DnsResolver;
  timeoutMs?: number;
  brevoApiKey?: string;
  brevoSenderEmail?: string;
  telegramBotToken?: string;
  masterCryptoKey?: string;
  now?: () => Date;
};

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const DEFAULT_MAX_REDIRECTS = 5;
const APPROVED_AI_MODEL = 'gpt-5.4-mini';
const MAX_PROCESSING_CANDIDATES = 50;
const MAX_ARTICLE_CHARS = 2_000;
const MAX_TOTAL_ARTICLE_CHARS = 60_000;
const OPENAI_MAX_OUTPUT_TOKENS = 4_000;
const NEAR_DUPLICATE_THRESHOLD = 0.6;

class IngestionWorkerError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'IngestionWorkerError';
  }
}

class ProcessingWorkerError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'ProcessingWorkerError';
  }
}

class DeliveryWorkerError extends Error {
  public circuitScopeType: string | null = null;
  public circuitScopeKey: string | null = null;

  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean,
    public readonly retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = 'DeliveryWorkerError';
  }
}

class DeliveryWorkerSkip extends Error {
  constructor(
    public readonly code: string,
    public readonly action: 'ack' | 'requeue',
    public readonly delaySeconds: number | null = null,
  ) {
    super(code);
    this.name = 'DeliveryWorkerSkip';
  }
}

const getText = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (typeof value === 'object' && '#text' in value) {
    return getText((value as Record<string, unknown>)['#text']);
  }
  return '';
};

export const sanitizeText = (value: unknown): string =>
  getText(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const asArray = <T>(value: T | T[] | undefined): T[] => {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
};

const getAtomLink = (entry: Record<string, unknown>): string => {
  const links = asArray(entry.link as Record<string, unknown> | string | undefined);
  for (const link of links) {
    if (typeof link === 'string') return link;
    if (link && typeof link === 'object') {
      const linkRecord = link as Record<string, unknown>;
      const rel = getText(linkRecord.rel);
      const href = getText(linkRecord.href);
      if (href && (!rel || rel === 'alternate')) return href;
    }
  }
  return '';
};

export function parseFeedItems(xml: string): ParsedFeedItem[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    trimValues: true,
    processEntities: false,
    htmlEntities: false,
  });
  const parsed = parser.parse(xml) as Record<string, unknown>;

  const rssChannel = (parsed.rss as Record<string, unknown> | undefined)?.channel as
    | Record<string, unknown>
    | undefined;
  if (rssChannel) {
    return asArray(
      rssChannel.item as Record<string, unknown> | Record<string, unknown>[] | undefined,
    )
      .map((item) => ({
        title: sanitizeText(item.title),
        description: sanitizeText(item.description),
        url: getText(item.link).trim(),
        publishedAt: getText(item.pubDate).trim() || null,
        externalGuid: getText(item.guid).trim() || null,
      }))
      .filter((item) => item.title && item.url);
  }

  const feed = parsed.feed as Record<string, unknown> | undefined;
  if (feed) {
    return asArray(feed.entry as Record<string, unknown> | Record<string, unknown>[] | undefined)
      .map((entry) => ({
        title: sanitizeText(entry.title),
        description: sanitizeText(entry.summary ?? entry.content),
        url: getAtomLink(entry).trim(),
        publishedAt: getText(entry.updated ?? entry.published).trim() || null,
        externalGuid: getText(entry.id).trim() || null,
      }))
      .filter((item) => item.title && item.url);
  }

  return [];
}

type ParsedHtmlDocument = {
  querySelector: (selector: string) => { textContent?: string | null } | null;
  body?: { textContent?: string | null } | null;
};

export function extractArticleFromHtml(
  html: string,
  url: string,
): { title: string; content: string } {
  const { document } = parseHTML(html) as unknown as { document: ParsedHtmlDocument };
  const article = new Readability(document as never, { keepClasses: false }).parse();
  const headingTitle = document.querySelector('article h1, h1')?.textContent;
  return {
    title: sanitizeText(
      headingTitle ?? article?.title ?? document.querySelector('title')?.textContent ?? url,
    ),
    content: sanitizeText(article?.textContent ?? document.body?.textContent ?? ''),
  };
}

async function readResponseTextLimited(
  response: Response,
  maxBytes: number,
  signal: AbortSignal,
): Promise<string> {
  if (!response.body) return '';

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      if (signal.aborted) {
        throw new IngestionWorkerError(
          'Fetch timed out while reading response body',
          'fetch_timeout',
        );
      }

      const { done, value } = await new Promise<ReadableStreamReadResult<Uint8Array>>(
        (resolve, reject) => {
          const onAbort = () =>
            reject(
              new IngestionWorkerError(
                'Fetch timed out while reading response body',
                'fetch_timeout',
              ),
            );
          signal.addEventListener('abort', onAbort, { once: true });
          reader.read().then(
            (result) => {
              signal.removeEventListener('abort', onAbort);
              resolve(result);
            },
            (error) => {
              signal.removeEventListener('abort', onAbort);
              reject(error);
            },
          );
        },
      );
      if (done) break;
      if (!value) continue;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel('response size limit exceeded');
        throw new IngestionWorkerError('Fetched content exceeds byte limit', 'content_too_large');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

export async function fetchTextWithTimeout(
  url: string,
  options: IngestionOptions = {},
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetchWithSsrfProtection(
      url,
      { method: 'GET', signal: controller.signal, headers: { Accept: '*/*' } },
      {
        fetchImpl: options.fetchImpl,
        resolveDns: options.resolveDns,
        followRedirects: true,
        maxRedirects: options.maxRedirects ?? DEFAULT_MAX_REDIRECTS,
      },
    );
    if (!response.ok) {
      throw new IngestionWorkerError('Fetch returned non-success status', 'fetch_failed');
    }
    return await readResponseTextLimited(
      response,
      options.maxBytes ?? DEFAULT_MAX_BYTES,
      controller.signal,
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchWithTimeout(
  url: string,
  options: IngestionOptions = {},
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    return await fetchWithSsrfProtection(
      url,
      { method: 'GET', signal: controller.signal, headers: { Accept: '*/*' } },
      {
        fetchImpl: options.fetchImpl,
        resolveDns: options.resolveDns,
        followRedirects: true,
        maxRedirects: options.maxRedirects ?? DEFAULT_MAX_REDIRECTS,
      },
    );
  } finally {
    clearTimeout(timeout);
  }
}

const sha256Hex = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

const hexToBytes = (hex: string): Uint8Array => {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) {
    return new TextEncoder().encode(hex);
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
};

const toPlainArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
};

const hmacSha256Hex = async (secret: string, value: string): Promise<string> => {
  const encodedValue = new TextEncoder().encode(value);
  const key = await crypto.subtle.importKey(
    'raw',
    toPlainArrayBuffer(hexToBytes(secret)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, toPlainArrayBuffer(encodedValue));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
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
      `https://api.telegram.org/bot${encodeURIComponent(botToken)}/sendMessage`,
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

const selectSingle = async <T>(
  supabaseAdmin: SupabaseAdmin,
  table: string,
  columns: string,
  predicates: Record<string, string>,
): Promise<T | null> => {
  let query = supabaseAdmin.from(table).select?.(columns);
  if (!query) throw new Error(`Table ${table} does not support select`);
  for (const [column, value] of Object.entries(predicates)) {
    query = query.eq(column, value);
  }
  const result = await query.limit?.(1).maybeSingle?.();
  if (result?.error) throw new Error(result.error.message);
  return (result?.data as T | null) ?? null;
};

const selectRows = async <T>(
  supabaseAdmin: SupabaseAdmin,
  table: string,
  columns: string,
  predicates: Record<string, string> = {},
  options: {
    limit?: number;
    orderBy?: string;
    ascending?: boolean;
    nullsFirst?: boolean;
  } = {},
): Promise<T[]> => {
  let query = supabaseAdmin.from(table).select?.(columns);
  if (!query) throw new Error(`Table ${table} does not support select`);
  for (const [column, value] of Object.entries(predicates)) {
    query = query.eq(column, value);
  }
  if (options.orderBy && query.order) {
    query = query.order(options.orderBy, {
      ascending: options.ascending ?? true,
      nullsFirst: options.nullsFirst,
    });
  }
  if (options.limit && query.limit) {
    query = query.limit(options.limit);
  }
  const result = await query;
  if (result.error) throw new Error(result.error.message);
  return ((result.data as T[] | null | undefined) ?? []) as T[];
};

const insertRows = async (
  supabaseAdmin: SupabaseAdmin,
  table: string,
  payload: Record<string, unknown> | Record<string, unknown>[],
) => {
  const query = supabaseAdmin.from(table).insert?.(payload);
  if (!query) throw new Error(`Table ${table} does not support insert`);
  const result = await query;
  if (result.error) throw new Error(result.error.message);
};

const isUniqueClaimError = (error: unknown): boolean =>
  error instanceof Error &&
  /duplicate key|unique constraint|violates unique/i.test(error.message);

const updateSourceHealth = async (
  supabaseAdmin: SupabaseAdmin,
  sourceId: string,
  patch: Record<string, unknown>,
) => {
  const { error } = await supabaseAdmin.from('global_sources').update(patch).eq('id', sourceId);
  if (error) throw new Error(`source health update failed: ${error.message}`);
};

async function recordOperationalEvent(
  supabaseAdmin: SupabaseAdmin,
  severity: 'warning' | 'critical',
  category: string,
  key: string,
  context: Record<string, unknown>,
) {
  assertRpcOk(
    await supabaseAdmin.rpc('log_operational_event', {
      p_severity: severity,
      p_category: category,
      p_deduplication_key: key,
      p_context: context,
    }),
    'log operational event failed',
  );
}

const getErrorName = (error: unknown): string =>
  error && typeof error === 'object' && 'name' in error
    ? String((error as { name?: unknown }).name)
    : '';

const safeErrorCode = (error: unknown): string => {
  if (error instanceof IngestionWorkerError) return error.code;
  if (error instanceof ProcessingWorkerError) return error.code;
  if (error instanceof DeliveryWorkerError) return error.code;
  if (getErrorName(error) === 'AbortError') return 'fetch_timeout';
  if (getErrorName(error) === 'SsrfProtectionError') return 'ssrf_blocked';
  return 'ingestion_failed';
};

const safeErrorMessage = (error: unknown): string => safeErrorCode(error).replace(/_/g, ' ');

const normalizePublishedAt = (value: string | null): string | null => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

export async function recordSourceFailure(
  supabaseAdmin: SupabaseAdmin,
  sourceId: string,
  errorCode: string,
) {
  const source = await selectSingle<Pick<SourceRecord, 'failed_fetch_count'>>(
    supabaseAdmin,
    'global_sources',
    'failed_fetch_count',
    { id: sourceId },
  );
  const failedFetchCount = (source?.failed_fetch_count ?? 0) + 1;
  const shouldPause = failedFetchCount >= 5;
  await updateSourceHealth(supabaseAdmin, sourceId, {
    failed_fetch_count: failedFetchCount,
    ...(shouldPause ? { status: 'paused' } : {}),
  });
  await recordOperationalEvent(
    supabaseAdmin,
    shouldPause ? 'critical' : 'warning',
    shouldPause ? 'source_disabled' : 'source_fetch_failed',
    `${shouldPause ? 'source_disabled' : 'source_fetch_failed'}_${sourceId}`,
    {
      source_id: sourceId,
      failed_fetch_count: failedFetchCount,
      error_code: errorCode,
    },
  );
}

async function resetSourceHealth(supabaseAdmin: SupabaseAdmin, sourceId: string) {
  await updateSourceHealth(supabaseAdmin, sourceId, {
    failed_fetch_count: 0,
    last_fetched_at: new Date().toISOString(),
  });
}

export async function filterDuplicateArticle(
  supabaseAdmin: SupabaseAdmin,
  sourceId: string,
  article: Pick<IngestedArticle, 'url' | 'external_guid'>,
): Promise<{ duplicate: boolean; urlHash: string; guidHash: string | null }> {
  const urlHash = await sha256Hex(article.url);
  const guidHash = article.external_guid ? await sha256Hex(article.external_guid) : null;

  const existingUrl = await selectSingle<{ id: string }>(
    supabaseAdmin,
    'source_item_fingerprints',
    'id',
    { source_id: sourceId, url_hash: urlHash },
  );
  if (existingUrl) return { duplicate: true, urlHash, guidHash };

  const existingArticleUrl = await selectSingle<{ id: string }>(
    supabaseAdmin,
    'ingested_articles',
    'id',
    { source_id: sourceId, url: article.url },
  );
  if (existingArticleUrl) return { duplicate: true, urlHash, guidHash };

  if (guidHash) {
    const existingGuid = await selectSingle<{ id: string }>(
      supabaseAdmin,
      'source_item_fingerprints',
      'id',
      { source_id: sourceId, guid_hash: guidHash },
    );
    if (existingGuid) return { duplicate: true, urlHash, guidHash };

    const existingArticleGuid = await selectSingle<{ id: string }>(
      supabaseAdmin,
      'ingested_articles',
      'id',
      { source_id: sourceId, external_guid: article.external_guid ?? '' },
    );
    if (existingArticleGuid) return { duplicate: true, urlHash, guidHash };
  }

  return { duplicate: false, urlHash, guidHash };
}

export async function ingestSource(
  supabaseAdmin: SupabaseAdmin,
  sourceId: string,
  options: IngestionOptions = {},
): Promise<{ inserted: number; skipped: number }> {
  const source = await selectSingle<SourceRecord>(
    supabaseAdmin,
    'global_sources',
    'id,url,type,status,failed_fetch_count',
    { id: sourceId },
  );
  if (!source) throw new Error(`Source not found: ${sourceId}`);
  if (source.status === 'paused') throw new Error(`Source is paused: ${sourceId}`);

  try {
    const body = await fetchTextWithTimeout(source.url, options);

    let articles: IngestedArticle[];
    if (source.type === 'web') {
      const extracted = extractArticleFromHtml(body, source.url);
      if (!extracted.title || !extracted.content) {
        throw new Error('Article extraction produced no content');
      }
      articles = [{
        external_guid: null,
        title: extracted.title,
        url: source.url,
        content: extracted.content,
        published_at: null,
      }];
    } else {
      articles = parseFeedItems(body).map((item) => ({
        external_guid: item.externalGuid,
        title: item.title,
        url: item.url,
        content: item.description || item.title,
        published_at: normalizePublishedAt(item.publishedAt),
      }));
    }

    let inserted = 0;
    let skipped = 0;
    for (const article of articles) {
      const duplicate = await filterDuplicateArticle(supabaseAdmin, sourceId, article);
      if (duplicate.duplicate) {
        skipped += 1;
        continue;
      }

      await insertRows(supabaseAdmin, 'ingested_articles', {
        source_id: sourceId,
        ...article,
      });
      await insertRows(supabaseAdmin, 'source_item_fingerprints', {
        source_id: sourceId,
        url_hash: duplicate.urlHash,
        guid_hash: duplicate.guidHash,
      });
      inserted += 1;
    }

    await resetSourceHealth(supabaseAdmin, sourceId);
    return { inserted, skipped };
  } catch (err: unknown) {
    const errorCode = safeErrorCode(err);
    await recordSourceFailure(supabaseAdmin, sourceId, errorCode);
    throw new IngestionWorkerError(safeErrorMessage(err), errorCode);
  }
}

type ProcessingFlowRecord = {
  id: string;
  user_id: string;
  name: string;
  ai_model: string;
  prompt_type: 'predefined' | 'custom';
  prompt_template: string | null;
  is_enabled: boolean;
};

type ProcessingRunRecord = {
  id: string;
  flow_id: string;
  cycle_date: string;
  status: string;
};

type FlowSourceRecord = {
  source_id: string;
};

type FlowArticleRecord = {
  article_id: string;
  processing_run_id: string;
  status: 'claimed' | 'included' | 'filtered';
};

export type ProcessingArticleCandidate = {
  id: string;
  source_id: string;
  title: string;
  url: string;
  content: string;
  published_at: string | null;
  created_at?: string | null;
};

export type GroupedArticle = {
  representative: ProcessingArticleCandidate;
  articles: ProcessingArticleCandidate[];
  text: string;
  sourceUrls: string[];
};

type StructuredDigest = {
  title: string;
  language: string;
  sections: Array<{
    heading: string;
    items: Array<{
      title: string;
      summary: string;
      source_urls: string[];
    }>;
  }>;
};

type OpenAiResponseBody = {
  id?: unknown;
  model?: unknown;
  output?: unknown;
  usage?: {
    total_tokens?: unknown;
    input_tokens?: unknown;
    output_tokens?: unknown;
  };
};

type DeliveryChannelType = 'in-app' | 'email' | 'telegram' | 'slack' | 'webhook';

type DeliveryAttemptRecord = {
  id: string;
  digest_id: string;
  channel_id: string | null;
  status: string;
};

type DeliveryChannelRecord = {
  id: string;
  user_id: string;
  type: DeliveryChannelType;
  status: string;
  config: unknown;
};

type ProcessedDigestRecord = {
  id: string;
  flow_id: string;
  content: StructuredDigest;
};

type DeliveryResult = {
  circuitScopeType: string | null;
  circuitScopeKey: string | null;
};

type ClaimDeliveryResult = {
  claimed?: boolean;
  status?: string;
  next_attempt_at?: string | null;
};

const secondsUntil = (isoDate: string | null | undefined): number => {
  if (!isoDate) return 300;
  const ms = new Date(isoDate).getTime();
  if (Number.isNaN(ms)) return 300;
  return Math.min(Math.max(Math.ceil((ms - Date.now()) / 1000), 1), 3600);
};

const normalizeWords = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);

export function createNGramSet(text: string, size = 3): Set<string> {
  const words = normalizeWords(text);
  if (words.length === 0) return new Set();
  if (words.length < size) return new Set([words.join(' ')]);
  const grams = new Set<string>();
  for (let index = 0; index <= words.length - size; index += 1) {
    grams.add(words.slice(index, index + size).join(' '));
  }
  return grams;
}

export function jaccardSimilarity(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 && right.size === 0) return 1;
  let intersection = 0;
  for (const value of left) {
    if (right.has(value)) intersection += 1;
  }
  const union = left.size + right.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

const truncateUnicode = (value: string, maxChars: number): string =>
  Array.from(value).slice(0, maxChars).join('');

const articleSortTime = (
  article: Pick<ProcessingArticleCandidate, 'published_at' | 'created_at'>,
) => {
  const value = article.published_at ?? article.created_at ?? '';
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
};

export function groupNearDuplicateArticles(
  articles: ProcessingArticleCandidate[],
  threshold = NEAR_DUPLICATE_THRESHOLD,
): GroupedArticle[] {
  const groups: Array<GroupedArticle & { shingles: Set<string> }> = [];

  for (const article of articles) {
    const articleText = `${article.title}\n${article.content}`;
    const shingles = createNGramSet(articleText);
    const existing = groups.find((group) =>
      jaccardSimilarity(group.shingles, shingles) >= threshold
    );

    if (existing) {
      existing.articles.push(article);
      existing.sourceUrls = Array.from(new Set([...existing.sourceUrls, article.url]));
      continue;
    }

    groups.push({
      representative: article,
      articles: [article],
      text: article.content,
      sourceUrls: [article.url],
      shingles,
    });
  }

  return groups.map((group) => ({
    representative: group.representative,
    articles: group.articles,
    text: group.text,
    sourceUrls: group.sourceUrls,
  }));
}

export function applyProcessingBudgets(
  groups: GroupedArticle[],
  perArticleChars = MAX_ARTICLE_CHARS,
  totalChars = MAX_TOTAL_ARTICLE_CHARS,
): GroupedArticle[] {
  const budgeted: GroupedArticle[] = [];
  let remaining = totalChars;

  for (const group of groups) {
    if (remaining <= 0) break;
    const text = truncateUnicode(
      group.representative.content,
      Math.min(perArticleChars, remaining),
    );
    if (!text) continue;
    budgeted.push({ ...group, text });
    remaining -= Array.from(text).length;
  }

  return budgeted;
}

const digestJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'language', 'sections'],
  properties: {
    title: { type: 'string' },
    language: { type: 'string' },
    sections: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['heading', 'items'],
        properties: {
          heading: { type: 'string' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['title', 'summary', 'source_urls'],
              properties: {
                title: { type: 'string' },
                summary: { type: 'string' },
                source_urls: {
                  type: 'array',
                  items: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

export function buildOpenAiDigestRequest(
  flow: Pick<ProcessingFlowRecord, 'name' | 'ai_model'>,
  groups: GroupedArticle[],
  customPrompt: string | null,
) {
  const articlePayload = groups.map((group, index) => ({
    group: index + 1,
    title: group.representative.title,
    source_urls: group.sourceUrls,
    near_duplicate_count: group.articles.length,
    text: group.text,
  }));

  const instructions = [
    'Create a concise personalized news digest from the provided article groups.',
    'Merge near-duplicate groups into one story item and cite all useful source URLs.',
    'Return only the strict JSON schema fields.',
    customPrompt
      ? `User preference: ${customPrompt}`
      : 'Use the default balanced news digest style.',
  ].join('\n');

  return {
    model: flow.ai_model || APPROVED_AI_MODEL,
    instructions,
    input: JSON.stringify({
      flow_name: flow.name,
      articles: articlePayload,
    }),
    max_output_tokens: OPENAI_MAX_OUTPUT_TOKENS,
    store: false,
    text: {
      format: {
        type: 'json_schema',
        name: 'news_digest',
        strict: true,
        schema: digestJsonSchema,
      },
    },
  };
}

const extractOutputText = (body: OpenAiResponseBody): string => {
  const output = Array.isArray(body.output) ? body.output : [];
  for (const item of output) {
    if (!item || typeof item !== 'object') continue;
    const content = Array.isArray((item as { content?: unknown }).content)
      ? (item as { content: unknown[] }).content
      : [];
    for (const part of content) {
      if (
        part &&
        typeof part === 'object' &&
        (part as { type?: unknown }).type === 'output_text' &&
        typeof (part as { text?: unknown }).text === 'string'
      ) {
        return (part as { text: string }).text;
      }
    }
  }
  return '';
};

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

export function parseStructuredDigest(value: unknown): StructuredDigest {
  if (!value || typeof value !== 'object') {
    throw new ProcessingWorkerError('AI response did not match digest schema', 'ai_schema_invalid');
  }
  const digest = value as StructuredDigest;
  if (
    typeof digest.title !== 'string' ||
    typeof digest.language !== 'string' ||
    !Array.isArray(digest.sections)
  ) {
    throw new ProcessingWorkerError('AI response did not match digest schema', 'ai_schema_invalid');
  }
  for (const section of digest.sections) {
    if (
      !section ||
      typeof section !== 'object' ||
      typeof section.heading !== 'string' ||
      !Array.isArray(section.items)
    ) {
      throw new ProcessingWorkerError(
        'AI response did not match digest schema',
        'ai_schema_invalid',
      );
    }
    for (const item of section.items) {
      if (
        !item ||
        typeof item !== 'object' ||
        typeof item.title !== 'string' ||
        typeof item.summary !== 'string' ||
        !isStringArray(item.source_urls)
      ) {
        throw new ProcessingWorkerError(
          'AI response did not match digest schema',
          'ai_schema_invalid',
        );
      }
    }
  }
  return digest;
}

export function parseOpenAiDigestResponse(body: OpenAiResponseBody): {
  digest: StructuredDigest;
  providerRequestId: string | null;
  model: string;
  tokenUsage: number;
} {
  const text = extractOutputText(body);
  if (!text) {
    throw new ProcessingWorkerError(
      'AI response did not include structured output',
      'ai_schema_invalid',
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ProcessingWorkerError('AI response was not valid JSON', 'ai_schema_invalid');
  }

  const tokenUsage = Number(body.usage?.total_tokens ?? 0);
  return {
    digest: parseStructuredDigest(parsed),
    providerRequestId: typeof body.id === 'string' ? body.id : null,
    model: typeof body.model === 'string' ? body.model : APPROVED_AI_MODEL,
    tokenUsage: Number.isFinite(tokenUsage) && tokenUsage >= 0 ? tokenUsage : 0,
  };
}

async function callOpenAiDigest(
  requestBody: ReturnType<typeof buildOpenAiDigestRequest>,
  apiKey: string,
  options: ProcessingOptions,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const fetchImpl = options.fetchImpl ?? fetch;
    const response = await fetchImpl('https://api.openai.com/v1/responses', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    if (!response.ok) {
      throw new ProcessingWorkerError('AI provider request failed', 'ai_provider_failed');
    }
    return parseOpenAiDigestResponse(await response.json() as OpenAiResponseBody);
  } catch (error: unknown) {
    if (error instanceof ProcessingWorkerError) throw error;
    if (getErrorName(error) === 'AbortError') {
      throw new ProcessingWorkerError('AI provider request timed out', 'ai_provider_timeout');
    }
    throw new ProcessingWorkerError('AI provider request failed', 'ai_provider_failed');
  } finally {
    clearTimeout(timeout);
  }
}

async function callOpenAiDigestWithSchemaRepair(
  requestBody: ReturnType<typeof buildOpenAiDigestRequest>,
  apiKey: string,
  options: ProcessingOptions,
) {
  try {
    return await callOpenAiDigest(requestBody, apiKey, options);
  } catch (error: unknown) {
    if (!(error instanceof ProcessingWorkerError) || error.code !== 'ai_schema_invalid') {
      throw error;
    }
  }

  return await callOpenAiDigest(
    {
      ...requestBody,
      instructions:
        `${requestBody.instructions}\n\nRepair attempt: the previous model output did not match the required JSON schema. Return only valid JSON that exactly matches the schema.`,
    },
    apiKey,
    options,
  );
}

const updateProcessingRun = async (
  supabaseAdmin: SupabaseAdmin,
  flowId: string,
  cycleDate: string,
  patch: Record<string, unknown>,
) => {
  const { error } = await supabaseAdmin
    .from('processing_runs')
    .update(patch)
    .eq('flow_id', flowId)
    .eq('cycle_date', cycleDate);
  if (error) throw new Error(`processing run update failed: ${error.message}`);
};

async function selectFlowCandidateArticles(
  supabaseAdmin: SupabaseAdmin,
  sourceIds: string[],
): Promise<ProcessingArticleCandidate[]> {
  const rows: ProcessingArticleCandidate[] = [];
  for (const sourceId of sourceIds) {
    rows.push(
      ...await selectRows<ProcessingArticleCandidate>(
        supabaseAdmin,
        'ingested_articles',
        'id,source_id,title,url,content,published_at,created_at',
        { source_id: sourceId },
        {
          orderBy: 'published_at',
          ascending: false,
          nullsFirst: false,
        },
      ),
    );
  }
  return rows
    .filter((article) => article.id && article.title && article.url && article.content)
    .sort((left, right) => articleSortTime(right) - articleSortTime(left));
}

async function claimArticlesForRun(
  supabaseAdmin: SupabaseAdmin,
  flowId: string,
  processingRunId: string,
  candidates: ProcessingArticleCandidate[],
): Promise<ProcessingArticleCandidate[]> {
  const claimed: ProcessingArticleCandidate[] = [];
  for (const article of candidates) {
    try {
      await insertRows(supabaseAdmin, 'flow_articles', {
        flow_id: flowId,
        article_id: article.id,
        processing_run_id: processingRunId,
        status: 'claimed',
      });
      claimed.push(article);
    } catch (error: unknown) {
      if (!isUniqueClaimError(error)) throw error;
    }
  }
  return claimed;
}

async function markExistingDigestArticlesIncluded(
  supabaseAdmin: SupabaseAdmin,
  flowId: string,
  processingRunId: string,
  digestId: string,
) {
  const { error } = await supabaseAdmin
    .from('flow_articles')
    .update({ status: 'included', digest_id: digestId })
    .eq('flow_id', flowId)
    .eq('processing_run_id', processingRunId);
  if (error) throw new Error(`flow article retry repair failed: ${error.message}`);
}

async function persistProcessingDigest(
  supabaseAdmin: SupabaseAdmin,
  payload: {
    digestId: string;
    flowId: string;
    processingRunId: string;
    content: StructuredDigest;
    tokenUsage: number;
    providerRequestId: string | null;
    model: string;
  },
): Promise<string> {
  const result = await supabaseAdmin.rpc('persist_processing_digest', {
    p_digest_id: payload.digestId,
    p_flow_id: payload.flowId,
    p_processing_run_id: payload.processingRunId,
    p_content: payload.content,
    p_token_usage: payload.tokenUsage,
    p_provider_request_id: payload.providerRequestId,
    p_model: payload.model,
  });
  return assertRpcOk(result, 'persist processing digest failed') as string;
}

export async function processFlow(
  supabaseAdmin: SupabaseAdmin,
  flowId: string,
  cycleDate: string,
  options: ProcessingOptions = {},
): Promise<{ outcome: 'completed' | 'no_content'; articleCount: number; digestId?: string }> {
  const flow = await selectSingle<ProcessingFlowRecord>(
    supabaseAdmin,
    'processing_flows',
    'id,user_id,name,ai_model,prompt_type,prompt_template,is_enabled',
    { id: flowId },
  );
  if (!flow) throw new ProcessingWorkerError('Processing flow not found', 'flow_not_found');
  if (!flow.is_enabled) {
    throw new ProcessingWorkerError('Processing flow disabled', 'flow_disabled');
  }
  if (flow.ai_model !== APPROVED_AI_MODEL) {
    throw new ProcessingWorkerError(
      'Processing flow model is not approved',
      'ai_model_not_allowed',
    );
  }

  const processingRun = await selectSingle<ProcessingRunRecord>(
    supabaseAdmin,
    'processing_runs',
    'id,flow_id,cycle_date,status',
    { flow_id: flowId, cycle_date: cycleDate },
  );
  if (!processingRun) {
    throw new ProcessingWorkerError('Processing run not found', 'processing_run_not_found');
  }

  const sourceRows = await selectRows<FlowSourceRecord>(
    supabaseAdmin,
    'flow_sources',
    'source_id',
    { flow_id: flowId },
  );
  const sourceIds = sourceRows.map((row) => row.source_id).filter(Boolean);
  if (sourceIds.length === 0) {
    await updateProcessingRun(supabaseAdmin, flowId, cycleDate, {
      status: 'no_content',
      completed_at: new Date().toISOString(),
      error_code: null,
    });
    return { outcome: 'no_content', articleCount: 0 };
  }

  const flowArticles = await selectRows<FlowArticleRecord>(
    supabaseAdmin,
    'flow_articles',
    'article_id,processing_run_id,status',
    { flow_id: flowId },
  );
  const existingDigest = await selectSingle<{ id: string }>(
    supabaseAdmin,
    'processed_digests',
    'id',
    { processing_run_id: processingRun.id },
  );
  if (existingDigest) {
    await markExistingDigestArticlesIncluded(
      supabaseAdmin,
      flowId,
      processingRun.id,
      existingDigest.id,
    );
    return {
      outcome: 'completed',
      articleCount: flowArticles.filter((row) => row.processing_run_id === processingRun.id)
        .length,
      digestId: existingDigest.id,
    };
  }

  const allArticles = await selectFlowCandidateArticles(supabaseAdmin, sourceIds);
  const currentRunClaimIds = new Set(
    flowArticles
      .filter((row) => row.processing_run_id === processingRun.id && row.status === 'claimed')
      .map((row) => row.article_id),
  );

  let claimedArticles = allArticles.filter((article) => currentRunClaimIds.has(article.id));
  if (claimedArticles.length === 0) {
    const alreadyClaimed = new Set(flowArticles.map((row) => row.article_id));
    const candidates = allArticles
      .filter((article) => !alreadyClaimed.has(article.id))
      .slice(0, MAX_PROCESSING_CANDIDATES);
    claimedArticles = await claimArticlesForRun(
      supabaseAdmin,
      flowId,
      processingRun.id,
      candidates,
    );
  }

  if (claimedArticles.length === 0) {
    await updateProcessingRun(supabaseAdmin, flowId, cycleDate, {
      status: 'no_content',
      completed_at: new Date().toISOString(),
      error_code: null,
    });
    return { outcome: 'no_content', articleCount: 0 };
  }

  const customPrompt = flow.prompt_type === 'custom'
    ? await decryptPromptTemplate(flow.prompt_template)
    : null;
  const grouped = applyProcessingBudgets(groupNearDuplicateArticles(claimedArticles));
  if (grouped.length === 0) {
    await updateProcessingRun(supabaseAdmin, flowId, cycleDate, {
      status: 'no_content',
      completed_at: new Date().toISOString(),
      error_code: null,
    });
    return { outcome: 'no_content', articleCount: 0 };
  }

  const apiKey = options.openAiApiKey;
  if (!apiKey) throw new ProcessingWorkerError('OpenAI API key not configured', 'ai_key_missing');

  const aiResult = await callOpenAiDigestWithSchemaRepair(
    buildOpenAiDigestRequest(flow, grouped, customPrompt),
    apiKey,
    options,
  );
  const digestId = crypto.randomUUID();
  const persistedDigestId = await persistProcessingDigest(supabaseAdmin, {
    digestId,
    flowId,
    processingRunId: processingRun.id,
    content: aiResult.digest,
    tokenUsage: aiResult.tokenUsage,
    providerRequestId: aiResult.providerRequestId,
    model: aiResult.model,
  });

  return {
    outcome: 'completed',
    articleCount: claimedArticles.length,
    digestId: persistedDigestId,
  };
}

const markProcessing = async (
  supabaseAdmin: SupabaseAdmin,
  kind: WorkerKind,
  message: JobPayload,
  cycleDate: string,
) => {
  if (kind === 'ingestion' && message.source_id) {
    const { error } = await supabaseAdmin
      .from('source_fetch_runs')
      .update({ status: 'processing', started_at: new Date().toISOString() })
      .eq('source_id', message.source_id)
      .eq('cycle_date', cycleDate);
    if (error) throw new Error(`mark ingestion processing failed: ${error.message}`);
  } else if (kind === 'processing' && message.flow_id) {
    const { error } = await supabaseAdmin
      .from('processing_runs')
      .update({ status: 'processing', started_at: new Date().toISOString() })
      .eq('flow_id', message.flow_id)
      .eq('cycle_date', cycleDate);
    if (error) throw new Error(`mark processing run failed: ${error.message}`);
  }
};

const completeJob = async (
  supabaseAdmin: SupabaseAdmin,
  activeQueue: string,
  msgId: string | number,
  kind: WorkerKind,
  message: JobPayload,
  cycleDate: string,
  deliveryResult: DeliveryResult | null = null,
) => {
  if (kind === 'delivery') {
    assertRpcOk(
      await supabaseAdmin.rpc('complete_delivery_worker_job', {
        p_queue_name: activeQueue,
        p_msg_id: msgId,
        p_attempt_id: message.attempt_id ?? null,
        p_circuit_scope_type: deliveryResult?.circuitScopeType ?? null,
        p_circuit_scope_key: deliveryResult?.circuitScopeKey ?? null,
      }),
      'complete delivery worker job failed',
    );
    return;
  }

  assertRpcOk(
    await supabaseAdmin.rpc('complete_worker_job', {
      p_queue_name: activeQueue,
      p_msg_id: msgId,
      p_job_type: kind,
      p_source_id: message.source_id ?? null,
      p_flow_id: message.flow_id ?? null,
      p_attempt_id: message.attempt_id ?? null,
      p_cycle_date: cycleDate,
    }),
    'complete worker job failed',
  );
};

const toDeliveryWorkerError = (error: unknown): DeliveryWorkerError => {
  if (error instanceof DeliveryWorkerError) return error;
  const code = safeErrorCode(error);
  const retryable = code === 'fetch_timeout' || code === 'delivery_not_due';
  return new DeliveryWorkerError(code, code, retryable);
};

const recordDeliveryFailure = async (
  supabaseAdmin: SupabaseAdmin,
  activeQueue: string,
  msgId: string | number,
  attemptId: string,
  error: DeliveryWorkerError,
) => {
  assertRpcOk(
    await supabaseAdmin.rpc('record_delivery_failure_worker_job', {
      p_queue_name: activeQueue,
      p_msg_id: msgId,
      p_attempt_id: attemptId,
      p_error_message: error.code,
      p_retryable: error.retryable,
      p_retry_after_seconds: error.retryAfterSeconds,
      p_circuit_scope_type: error.circuitScopeType,
      p_circuit_scope_key: error.circuitScopeKey,
    }),
    'record delivery failure failed',
  );
};

const acknowledgeDeliveryJob = async (
  supabaseAdmin: SupabaseAdmin,
  activeQueue: string,
  msgId: string | number,
) => {
  assertRpcOk(
    await supabaseAdmin.rpc('acknowledge_delivery_worker_job', {
      p_queue_name: activeQueue,
      p_msg_id: msgId,
    }),
    'acknowledge delivery worker job failed',
  );
};

const requeueDeliveryJob = async (
  supabaseAdmin: SupabaseAdmin,
  activeQueue: string,
  msgId: string | number,
  attemptId: string,
  delaySeconds: number,
) => {
  assertRpcOk(
    await supabaseAdmin.rpc('requeue_delivery_worker_job', {
      p_queue_name: activeQueue,
      p_msg_id: msgId,
      p_attempt_id: attemptId,
      p_delay_seconds: delaySeconds,
    }),
    'requeue delivery worker job failed',
  );
};

const failJob = async (
  supabaseAdmin: SupabaseAdmin,
  kind: WorkerKind,
  message: JobPayload,
  cycleDate: string,
  errorMessage: string,
) => {
  assertRpcOk(
    await supabaseAdmin.rpc('fail_worker_job', {
      p_job_type: kind,
      p_error_message: errorMessage,
      p_source_id: message.source_id ?? null,
      p_flow_id: message.flow_id ?? null,
      p_attempt_id: message.attempt_id ?? null,
      p_cycle_date: cycleDate,
    }),
    'record worker failure failed',
  );
};

type CreateAdminClient = (url: string, serviceKey: string) => SupabaseAdmin;
type WorkHandlerOptions = {
  ingestion?: IngestionOptions;
  processing?: ProcessingOptions;
  delivery?: DeliveryOptions;
};

export const createWorkHandler =
  (createAdminClient: CreateAdminClient, options: WorkHandlerOptions = {}) =>
  async (req: Request, envs: Record<string, string>) => {
    const authHeader = req.headers.get('Authorization') ?? '';
    const serviceKey = envs.SUPABASE_SERVICE_ROLE_KEY ?? '';

    if (!serviceKey) return json({ error: 'Unauthorized: Service key not configured' }, 401);
    if (authHeader !== `Bearer ${serviceKey}` && authHeader !== serviceKey) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const supabaseAdmin = createAdminClient(envs.SUPABASE_URL ?? '', serviceKey);

    const queues = ['delivery-queue', 'processing-queue', 'ingestion-queue'];
    let claimedJob: JobMessage | null = null;
    let activeQueue = '';

    for (const queueName of queues) {
      const { data, error } = await supabaseAdmin.rpc('claim_job', {
        queue_name: queueName,
        lease_seconds: 300,
      });
      if (error) {
        return json({ status: 'claim_failed', queue: queueName, error: error.message }, 500);
      }
      const jobs = data as JobMessage[] | null;
      if (jobs && jobs.length > 0) {
        claimedJob = jobs[0];
        activeQueue = queueName;
        break;
      }
    }

    if (!claimedJob) return json({ status: 'idle', message: 'No jobs in queue' });

    const { msg_id: msgId, read_ct: readCount, message } = claimedJob;
    const kind = getWorkerKind(activeQueue, message);
    const cycleDate = message.cycle_date || new Date().toISOString().split('T')[0];

    if (!kind) return json({ status: 'failed', msg_id: msgId, error: 'Unsupported job type' }, 500);

    if (readCount > 5) {
      const { error } = await supabaseAdmin.rpc('archive_exhausted_worker_job', {
        p_queue_name: activeQueue,
        p_msg_id: msgId,
        p_event_key: `msg_failed_dlq_${activeQueue}_${msgId}`,
        p_context: sanitizeDlqContext(activeQueue, message),
      });
      if (error) {
        return json({ status: 'dlq_archive_failed', msg_id: msgId, error: error.message }, 500);
      }
      return json({ status: 'dlq_archived', msg_id: msgId, reason: 'Retry count exceeded 5' });
    }

    let deliveryProviderAccepted = false;

    try {
      await markProcessing(supabaseAdmin, kind, message, cycleDate);

      if (message.simulate_failure) throw new Error('Simulated worker execution failure');
      let deliveryResult: DeliveryResult | null = null;
      if (kind === 'ingestion') {
        if (!message.source_id) throw new Error('Ingestion job missing source_id');
        await ingestSource(supabaseAdmin, message.source_id, options.ingestion);
      } else if (kind === 'processing') {
        if (!message.flow_id) throw new Error('Processing job missing flow_id');
        await processFlow(supabaseAdmin, message.flow_id, cycleDate, {
          ...options.processing,
          openAiApiKey: options.processing?.openAiApiKey ?? envs.OPENAI_API_KEY,
        });
      } else if (kind === 'delivery') {
        if (!message.attempt_id) throw new Error('Delivery job missing attempt_id');
        deliveryResult = await deliverAttempt(supabaseAdmin, message.attempt_id, {
          ...options.delivery,
          brevoApiKey: options.delivery?.brevoApiKey ?? envs.BREVO_API_KEY,
          brevoSenderEmail: options.delivery?.brevoSenderEmail ?? envs.BREVO_SENDER_EMAIL,
          telegramBotToken: options.delivery?.telegramBotToken ?? envs.TELEGRAM_BOT_TOKEN,
          masterCryptoKey: options.delivery?.masterCryptoKey ?? envs.MASTER_CRYPTO_KEY,
        });
        deliveryProviderAccepted = true;
      }

      await completeJob(
        supabaseAdmin,
        activeQueue,
        msgId,
        kind,
        message,
        cycleDate,
        deliveryResult,
      );

      return json({ status: 'completed', msg_id: msgId });
    } catch (err: unknown) {
      if (kind === 'delivery' && message.attempt_id) {
        if (deliveryProviderAccepted && !(err instanceof DeliveryWorkerError)) {
          const completionError = err instanceof Error ? err.message : 'Unknown execution failure';
          return json({ status: 'failed', msg_id: msgId, error: completionError }, 500);
        }

        if (err instanceof DeliveryWorkerSkip) {
          try {
            if (err.action === 'ack') {
              await acknowledgeDeliveryJob(supabaseAdmin, activeQueue, msgId);
            } else {
              await requeueDeliveryJob(
                supabaseAdmin,
                activeQueue,
                msgId,
                message.attempt_id,
                err.delaySeconds ?? 300,
              );
            }
          } catch (skipRecordErr: unknown) {
            const recordError = skipRecordErr instanceof Error
              ? skipRecordErr.message
              : 'Unknown delivery skip recording error';
            return json({
              status: 'failed',
              msg_id: msgId,
              error: err.code,
              failure_record_error: recordError,
            }, 500);
          }

          return json({
            status: err.action === 'ack' ? 'completed' : 'delivery_requeued',
            msg_id: msgId,
            error: err.code,
          });
        }

        const deliveryError = toDeliveryWorkerError(err);
        try {
          await recordDeliveryFailure(
            supabaseAdmin,
            activeQueue,
            msgId,
            message.attempt_id,
            deliveryError,
          );
        } catch (failureRecordErr: unknown) {
          const recordError = failureRecordErr instanceof Error
            ? failureRecordErr.message
            : 'Unknown failure recording error';
          return json({
            status: 'failed',
            msg_id: msgId,
            error: deliveryError.code,
            failure_record_error: recordError,
          }, 500);
        }

        return json(
          {
            status: deliveryError.retryable ? 'failed' : 'delivery_failed_permanent',
            msg_id: msgId,
            error: deliveryError.code,
          },
          deliveryError.retryable ? 500 : 200,
        );
      }

      const errMsg = err instanceof IngestionWorkerError || err instanceof ProcessingWorkerError
        ? safeErrorMessage(err)
        : err instanceof Error
        ? err.message
        : 'Unknown execution failure';

      try {
        await failJob(supabaseAdmin, kind, message, cycleDate, errMsg);
      } catch (failureRecordErr: unknown) {
        const recordError = failureRecordErr instanceof Error
          ? failureRecordErr.message
          : 'Unknown failure recording error';
        return json({
          status: 'failed',
          msg_id: msgId,
          error: errMsg,
          failure_record_error: recordError,
        }, 500);
      }

      return json({ status: 'failed', msg_id: msgId, error: errMsg }, 500);
    }
  };

export const workHandler = createWorkHandler((url, serviceKey) =>
  createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as unknown as SupabaseAdmin
);

export default {
  fetch: withSupabase({ auth: ['secret'] }, async (req) => {
    try {
      const envs = {
        SUPABASE_URL: Deno.env.get('SUPABASE_URL') ?? '',
        SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        OPENAI_API_KEY: Deno.env.get('OPENAI_API_KEY') ?? '',
        BREVO_API_KEY: Deno.env.get('BREVO_API_KEY') ?? '',
        BREVO_SENDER_EMAIL: Deno.env.get('BREVO_SENDER_EMAIL') ?? '',
        TELEGRAM_BOT_TOKEN: Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '',
        MASTER_CRYPTO_KEY: Deno.env.get('MASTER_CRYPTO_KEY') ?? '',
      };
      return await workHandler(req, envs);
    } catch (err: unknown) {
      return json({ error: err instanceof Error ? err.message : 'Internal Server Error' }, 500);
    }
  }),
};
