import { assertRpcOk } from './db.ts';
import { safeErrorCode } from './errors.ts';
import { emitStructuredLog, safeLogValue } from './logging.ts';
import type { AlertEventClaim, OperatorAlertOptions, SupabaseAdmin } from './types.ts';

export async function recordOperationalEvent(
  supabaseAdmin: SupabaseAdmin,
  severity: 'warning' | 'critical',
  category: string,
  key: string,
  context: Record<string, unknown>,
) {
  return assertRpcOk(
    await supabaseAdmin.rpc('log_operational_event', {
      p_severity: severity,
      p_category: category,
      p_deduplication_key: key,
      p_context: context,
    }),
    'log operational event failed',
  ) as string;
}

export const asPositiveInteger = (value: unknown): number | null => {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return Math.floor(numeric);
};

export const parseConfiguredBudget = (value: string | number | undefined): number | null =>
  value === undefined || value === '' ? null : asPositiveInteger(value);

async function sendOperatorAlertEmail(
  event: AlertEventClaim,
  options: OperatorAlertOptions,
): Promise<boolean> {
  const apiKey = options.brevoApiKey;
  const senderEmail = options.brevoSenderEmail;
  const operatorEmail = options.operatorAlertEmail;
  if (!apiKey || !senderEmail || !operatorEmail) return false;

  const fetchImpl = options.fetchImpl ?? fetch;
  const body = {
    sender: { email: senderEmail },
    to: [{ email: operatorEmail }],
    subject: `[News Aggregator] ${event.severity ?? 'critical'} ${event.category ?? 'event'}`,
    textContent: [
      `Operational event: ${event.category ?? 'unknown'}`,
      `Severity: ${event.severity ?? 'unknown'}`,
      `Event ID: ${event.event_id ?? 'unknown'}`,
      `Deduplication key: ${event.deduplication_key ?? 'unknown'}`,
      `Occurrences: ${event.occurrence_count ?? 1}`,
      `Context: ${JSON.stringify(safeLogValue(event.context ?? {}))}`,
    ].join('\n'),
  };

  const response = await fetchImpl('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`operator_alert_http_${response.status}`);
  }
  return true;
}

export async function alertCriticalOperationalEvent(
  supabaseAdmin: SupabaseAdmin,
  eventId: string | null,
  options: OperatorAlertOptions,
): Promise<boolean> {
  if (!eventId) return false;
  let claim: AlertEventClaim;
  try {
    claim = assertRpcOk(
      await supabaseAdmin.rpc('claim_operational_event_alert', {
        p_event_id: eventId,
        p_cooldown: '1 hour',
      }),
      'claim operational alert failed',
    ) as AlertEventClaim;
  } catch (error: unknown) {
    emitStructuredLog(options.logger ?? console, 'warn', 'operator_alert.claim_failed', {
      correlation_id: options.correlationId ?? null,
      event_id: eventId,
      error_code: safeErrorCode(error),
    });
    return false;
  }
  if (!claim.claimed) return false;

  try {
    const sent = await sendOperatorAlertEmail(claim, options);
    emitStructuredLog(options.logger ?? console, sent ? 'info' : 'warn', 'operator_alert.result', {
      correlation_id: options.correlationId ?? null,
      event_id: claim.event_id ?? eventId,
      category: claim.category ?? null,
      sent,
    });
    return sent;
  } catch (error: unknown) {
    emitStructuredLog(options.logger ?? console, 'warn', 'operator_alert.failed', {
      correlation_id: options.correlationId ?? null,
      event_id: claim.event_id ?? eventId,
      category: claim.category ?? null,
      error_code: safeErrorCode(error),
    });
    return false;
  }
}

export async function getAiTokenUsageSince(
  supabaseAdmin: SupabaseAdmin,
  since: string,
): Promise<number> {
  const usage = assertRpcOk(
    await supabaseAdmin.rpc('get_ai_token_usage_since', { p_since: since }),
    'get ai token usage failed',
  );
  return asPositiveInteger(usage) ?? 0;
}

export async function recordAiUsageEvent(
  supabaseAdmin: SupabaseAdmin,
  payload: {
    flowId: string;
    processingRunId: string;
    providerRequestId: string | null;
    model: string;
    tokenUsage: number;
    outcome: 'failed_budget' | 'failed_provider';
    reason: string;
  },
) {
  assertRpcOk(
    await supabaseAdmin.rpc('record_ai_usage_event', {
      p_flow_id: payload.flowId,
      p_processing_run_id: payload.processingRunId,
      p_provider_request_id: payload.providerRequestId,
      p_model: payload.model,
      p_token_usage: payload.tokenUsage,
      p_outcome: payload.outcome,
      p_reason: payload.reason,
    }),
    'record ai usage event failed',
  );
}

export async function recordProviderQuotaEvent(
  supabaseAdmin: SupabaseAdmin,
  reason: string,
  context: Record<string, unknown>,
  alerting?: OperatorAlertOptions,
) {
  const eventId = await recordOperationalEvent(
    supabaseAdmin,
    'critical',
    'provider_quota',
    `provider_quota_${reason}`,
    { provider: 'openai', reason, ...context },
  );
  await alertCriticalOperationalEvent(supabaseAdmin, eventId, alerting ?? {});
}
