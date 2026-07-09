import { decryptPromptTemplate } from '../api/crypto.ts';
import {
  APPROVED_AI_MODEL,
  DEFAULT_TIMEOUT_MS,
  MAX_ARTICLE_CHARS,
  MAX_PROCESSING_CANDIDATES,
  MAX_TOTAL_ARTICLE_CHARS,
  NEAR_DUPLICATE_THRESHOLD,
  OPENAI_MAX_OUTPUT_TOKENS,
} from './constants.ts';
import { assertRpcOk, insertRows, isUniqueClaimError, selectRows, selectSingle } from './db.ts';
import { getErrorName, ProcessingWorkerError } from './errors.ts';
import {
  asPositiveInteger,
  getAiTokenUsageSince,
  recordAiUsageEvent,
  recordProviderQuotaEvent,
} from './alerting.ts';
import type {
  FlowArticleRecord,
  FlowSourceRecord,
  GroupedArticle,
  OpenAiDigestResponseMetadata,
  OpenAiResponseBody,
  ProcessingArticleCandidate,
  ProcessingFlowRecord,
  ProcessingOptions,
  ProcessingRunRecord,
  StructuredDigest,
  SupabaseAdmin,
} from './types.ts';

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
  const metadata = extractOpenAiDigestMetadata(body);
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

  return {
    digest: parseStructuredDigest(parsed),
    ...metadata,
  };
}

const extractOpenAiDigestMetadata = (body: OpenAiResponseBody): OpenAiDigestResponseMetadata => {
  const tokenUsage = Number(body.usage?.total_tokens ?? 0);
  return {
    providerRequestId: typeof body.id === 'string' ? body.id : null,
    model: typeof body.model === 'string' ? body.model : APPROVED_AI_MODEL,
    tokenUsage: Number.isFinite(tokenUsage) && tokenUsage >= 0 ? tokenUsage : 0,
  };
};

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
    const body = await response.json() as OpenAiResponseBody;
    const metadata = extractOpenAiDigestMetadata(body);
    await options.onOpenAiResponse?.(metadata);
    try {
      return parseOpenAiDigestResponse(body);
    } catch (error: unknown) {
      if (error instanceof ProcessingWorkerError && error.code === 'ai_schema_invalid') {
        await options.onOpenAiSchemaInvalid?.(metadata);
      }
      throw error;
    }
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

  const dayStart = `${cycleDate}T00:00:00.000Z`;
  const dailyBudget = asPositiveInteger(options.aiDailyTokenBudget);
  const currentDailyUsage = dailyBudget === null
    ? 0
    : await getAiTokenUsageSince(supabaseAdmin, dayStart);
  if (dailyBudget !== null && currentDailyUsage >= dailyBudget) {
    await recordProviderQuotaEvent(
      supabaseAdmin,
      'daily_budget_exhausted',
      {
        flow_id: flowId,
        processing_run_id: processingRun.id,
        cycle_date: cycleDate,
        daily_budget: dailyBudget,
        current_usage: currentDailyUsage,
      },
      options.alerting,
    );
    throw new ProcessingWorkerError('AI daily token budget exhausted', 'ai_budget_exhausted');
  }

  const responseBudget = asPositiveInteger(options.aiResponseTokenBudget);
  let failedProviderTokenUsageThisAttempt = 0;
  const enforceProviderResponseBudget = async (metadata: OpenAiDigestResponseMetadata) => {
    const effectiveCurrentUsage = currentDailyUsage + failedProviderTokenUsageThisAttempt;
    const exceedsResponseBudget = responseBudget !== null && metadata.tokenUsage > responseBudget;
    const exceedsDailyBudget = dailyBudget !== null &&
      effectiveCurrentUsage + metadata.tokenUsage > dailyBudget;
    if (!exceedsResponseBudget && !exceedsDailyBudget) return;

    const budgetReason = exceedsResponseBudget
      ? 'response_budget_exceeded'
      : 'daily_budget_exceeded';
    await recordAiUsageEvent(supabaseAdmin, {
      flowId,
      processingRunId: processingRun.id,
      providerRequestId: metadata.providerRequestId,
      model: metadata.model,
      tokenUsage: metadata.tokenUsage,
      outcome: 'failed_budget',
      reason: budgetReason,
    });
    await recordProviderQuotaEvent(
      supabaseAdmin,
      budgetReason,
      {
        flow_id: flowId,
        processing_run_id: processingRun.id,
        cycle_date: cycleDate,
        daily_budget: dailyBudget,
        current_usage: effectiveCurrentUsage,
        response_budget: responseBudget,
        response_usage: metadata.tokenUsage,
        provider_request_id: metadata.providerRequestId,
        model: metadata.model,
      },
      options.alerting,
    );
    throw new ProcessingWorkerError('AI token budget exceeded', 'ai_budget_exhausted');
  };
  const recordSchemaInvalidProviderUsage = async (metadata: OpenAiDigestResponseMetadata) => {
    if (metadata.tokenUsage <= 0 && !metadata.providerRequestId) return;
    await recordAiUsageEvent(supabaseAdmin, {
      flowId,
      processingRunId: processingRun.id,
      providerRequestId: metadata.providerRequestId,
      model: metadata.model,
      tokenUsage: metadata.tokenUsage,
      outcome: 'failed_provider',
      reason: 'ai_schema_invalid',
    });
    failedProviderTokenUsageThisAttempt += metadata.tokenUsage;
  };

  const aiResult = await callOpenAiDigestWithSchemaRepair(
    buildOpenAiDigestRequest(flow, grouped, customPrompt),
    apiKey,
    {
      ...options,
      onOpenAiResponse: enforceProviderResponseBudget,
      onOpenAiSchemaInvalid: recordSchemaInvalidProviderUsage,
    },
  );
  const effectiveCurrentUsage = currentDailyUsage + failedProviderTokenUsageThisAttempt;
  const exceedsResponseBudget = responseBudget !== null && aiResult.tokenUsage > responseBudget;
  const exceedsDailyBudget = dailyBudget !== null &&
    effectiveCurrentUsage + aiResult.tokenUsage > dailyBudget;
  if (exceedsResponseBudget || exceedsDailyBudget) {
    const budgetReason = exceedsResponseBudget
      ? 'response_budget_exceeded'
      : 'daily_budget_exceeded';
    await recordAiUsageEvent(supabaseAdmin, {
      flowId,
      processingRunId: processingRun.id,
      providerRequestId: aiResult.providerRequestId,
      model: aiResult.model,
      tokenUsage: aiResult.tokenUsage,
      outcome: 'failed_budget',
      reason: budgetReason,
    });
    await recordProviderQuotaEvent(
      supabaseAdmin,
      budgetReason,
      {
        flow_id: flowId,
        processing_run_id: processingRun.id,
        cycle_date: cycleDate,
        daily_budget: dailyBudget,
        current_usage: effectiveCurrentUsage,
        response_budget: responseBudget,
        response_usage: aiResult.tokenUsage,
        provider_request_id: aiResult.providerRequestId,
        model: aiResult.model,
      },
      options.alerting,
    );
    throw new ProcessingWorkerError('AI token budget exceeded', 'ai_budget_exhausted');
  }
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
