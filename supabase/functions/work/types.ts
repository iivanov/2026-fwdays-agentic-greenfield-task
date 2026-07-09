import type { DnsResolver, FetchLike } from '../api/ssrf.ts';

export interface JobPayload {
  type?: string;
  source_id?: string;
  flow_id?: string;
  attempt_id?: string;
  cycle_date?: string;
  simulate_failure?: boolean;
}

export interface JobMessage {
  msg_id: string | number;
  read_ct: number;
  enqueued_at: string;
  message: JobPayload;
}

export type RpcResult<T = unknown> = { data: T; error: { message: string } | null };

export type QueryBuilder = {
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

export type SupabaseAdmin = {
  rpc: (name: string, args?: Record<string, unknown>) => Promise<RpcResult>;
  from: (table: string) => {
    select?: (columns?: string) => QueryBuilder;
    insert?: (payload: Record<string, unknown> | Record<string, unknown>[]) => QueryBuilder;
    update: (patch: Record<string, unknown>) => QueryBuilder;
  };
};

export type WorkerKind = 'ingestion' | 'processing' | 'delivery';
export type LogLevel = 'info' | 'warn' | 'error';
export type SafeLogger = Pick<Console, 'log' | 'warn' | 'error'>;

export type AlertEventClaim = {
  claimed?: boolean;
  event_id?: string;
  severity?: string;
  category?: string;
  deduplication_key?: string;
  context?: Record<string, unknown>;
  occurrence_count?: number;
};

export type OperatorAlertOptions = {
  fetchImpl?: FetchLike;
  brevoApiKey?: string;
  brevoSenderEmail?: string;
  operatorAlertEmail?: string;
  logger?: SafeLogger;
  correlationId?: string;
};

export type SourceRecord = {
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

export type IngestedArticle = {
  external_guid: string | null;
  title: string;
  url: string;
  content: string;
  published_at: string | null;
};

export type IngestionOptions = {
  fetchImpl?: FetchLike;
  resolveDns?: DnsResolver;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
};

export type ProcessingOptions = {
  fetchImpl?: FetchLike;
  openAiApiKey?: string;
  timeoutMs?: number;
  aiDailyTokenBudget?: number | null;
  aiResponseTokenBudget?: number | null;
  alerting?: OperatorAlertOptions;
  onOpenAiResponse?: (metadata: OpenAiDigestResponseMetadata) => void | Promise<void>;
  onOpenAiSchemaInvalid?: (metadata: OpenAiDigestResponseMetadata) => void | Promise<void>;
};

export type DeliveryOptions = {
  fetchImpl?: FetchLike;
  resolveDns?: DnsResolver;
  timeoutMs?: number;
  brevoApiKey?: string;
  brevoSenderEmail?: string;
  telegramBotToken?: string;
  masterCryptoKey?: string;
  now?: () => Date;
};

export type ProcessingFlowRecord = {
  id: string;
  user_id: string;
  name: string;
  ai_model: string;
  prompt_type: 'predefined' | 'custom';
  prompt_template: string | null;
  is_enabled: boolean;
};

export type ProcessingRunRecord = {
  id: string;
  flow_id: string;
  cycle_date: string;
  status: string;
};

export type FlowSourceRecord = {
  source_id: string;
};

export type FlowArticleRecord = {
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

export type StructuredDigest = {
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

export type OpenAiResponseBody = {
  id?: unknown;
  model?: unknown;
  output?: unknown;
  usage?: {
    total_tokens?: unknown;
    input_tokens?: unknown;
    output_tokens?: unknown;
  };
};

export type OpenAiDigestResponseMetadata = {
  providerRequestId: string | null;
  model: string;
  tokenUsage: number;
};

export type DeliveryChannelType = 'in-app' | 'email' | 'telegram' | 'slack' | 'webhook';

export type DeliveryAttemptRecord = {
  id: string;
  digest_id: string;
  channel_id: string | null;
  status: string;
};

export type DeliveryChannelRecord = {
  id: string;
  user_id: string;
  type: DeliveryChannelType;
  status: string;
  config: unknown;
};

export type ProcessedDigestRecord = {
  id: string;
  flow_id: string;
  content: StructuredDigest;
};

export type DeliveryResult = {
  circuitScopeType: string | null;
  circuitScopeKey: string | null;
};

export type ClaimDeliveryResult = {
  claimed?: boolean;
  status?: string;
  next_attempt_at?: string | null;
};
