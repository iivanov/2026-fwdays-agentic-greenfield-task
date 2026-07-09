import { alertCriticalOperationalEvent, parseConfiguredBudget } from './alerting.ts';
import { assertRpcOk } from './db.ts';
import { deliverAttempt } from './delivery.ts';
import {
  DeliveryWorkerError,
  DeliveryWorkerSkip,
  IngestionWorkerError,
  ProcessingWorkerError,
  safeErrorCode,
  safeErrorMessage,
} from './errors.ts';
import { ingestSource } from './ingestion.ts';
import { emitStructuredLog, getWorkerKind, jobLogContext, sanitizeDlqContext } from './logging.ts';
import { processFlow } from './processing.ts';
import type {
  DeliveryOptions,
  DeliveryResult,
  IngestionOptions,
  JobMessage,
  JobPayload,
  ProcessingOptions,
  SafeLogger,
  SupabaseAdmin,
  WorkerKind,
} from './types.ts';

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

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

const failTerminalProcessingJob = async (
  supabaseAdmin: SupabaseAdmin,
  activeQueue: string,
  msgId: string | number,
  message: JobPayload,
  cycleDate: string,
  errorMessage: string,
) => {
  assertRpcOk(
    await supabaseAdmin.rpc('fail_terminal_processing_worker_job', {
      p_queue_name: activeQueue,
      p_msg_id: msgId,
      p_flow_id: message.flow_id ?? null,
      p_cycle_date: cycleDate,
      p_error_message: errorMessage,
    }),
    'record terminal processing failure failed',
  );
};

export type CreateAdminClient = (url: string, serviceKey: string) => SupabaseAdmin;
export type WorkHandlerOptions = {
  ingestion?: IngestionOptions;
  processing?: ProcessingOptions;
  delivery?: DeliveryOptions;
  logger?: SafeLogger;
};

export const createWorkHandler =
  (createAdminClient: CreateAdminClient, options: WorkHandlerOptions = {}) =>
  async (req: Request, envs: Record<string, string>) => {
    const logger = options.logger ?? console;
    const correlationId = req.headers.get('X-Request-Id') ?? crypto.randomUUID();
    const startedAt = Date.now();
    const authHeader = req.headers.get('Authorization') ?? '';
    const serviceKey = envs.SUPABASE_SERVICE_ROLE_KEY ?? '';
    const schedulerSecret = envs.SCHEDULER_SECRET ?? '';

    if (!serviceKey) return json({ error: 'Unauthorized: Service key not configured' }, 401);
    const acceptedSecrets = [schedulerSecret, serviceKey].filter(Boolean);
    const isAuthorized = acceptedSecrets.some(
      (secret) => authHeader === `Bearer ${secret}` || authHeader === secret,
    );
    if (!isAuthorized) {
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
        emitStructuredLog(logger, 'error', 'work.claim_failed', {
          correlation_id: correlationId,
          queue: queueName,
          duration_ms: Date.now() - startedAt,
          error_code: 'claim_failed',
        });
        return json({ status: 'claim_failed', queue: queueName, error: error.message }, 500);
      }
      const jobs = data as JobMessage[] | null;
      if (jobs && jobs.length > 0) {
        claimedJob = jobs[0];
        activeQueue = queueName;
        break;
      }
    }

    if (!claimedJob) {
      emitStructuredLog(logger, 'info', 'work.idle', {
        correlation_id: correlationId,
        duration_ms: Date.now() - startedAt,
      });
      return json({ status: 'idle', message: 'No jobs in queue' });
    }

    const { msg_id: msgId, read_ct: readCount, message } = claimedJob;
    const kind = getWorkerKind(activeQueue, message);
    const cycleDate = message.cycle_date || new Date().toISOString().split('T')[0];

    if (!kind) {
      emitStructuredLog(logger, 'error', 'work.failed', {
        ...jobLogContext(correlationId, activeQueue, msgId, readCount, kind, message, startedAt),
        outcome: 'unsupported_job_type',
      });
      return json({ status: 'failed', msg_id: msgId, error: 'Unsupported job type' }, 500);
    }

    emitStructuredLog(logger, 'info', 'work.claimed', {
      ...jobLogContext(correlationId, activeQueue, msgId, readCount, kind, message, startedAt),
      outcome: 'claimed',
    });

    if (readCount > 5) {
      const { data, error } = await supabaseAdmin.rpc('archive_exhausted_worker_job', {
        p_queue_name: activeQueue,
        p_msg_id: msgId,
        p_event_key: `msg_failed_dlq_${activeQueue}_${msgId}`,
        p_context: sanitizeDlqContext(activeQueue, message),
      });
      if (error) {
        emitStructuredLog(logger, 'error', 'work.failed', {
          ...jobLogContext(correlationId, activeQueue, msgId, readCount, kind, message, startedAt),
          outcome: 'dlq_archive_failed',
          error_code: 'dlq_archive_failed',
        });
        return json({ status: 'dlq_archive_failed', msg_id: msgId, error: error.message }, 500);
      }
      const archived = data as { event_id?: string | null } | null;
      await alertCriticalOperationalEvent(supabaseAdmin, archived?.event_id ?? null, {
        fetchImpl: options.delivery?.fetchImpl,
        brevoApiKey: options.delivery?.brevoApiKey ?? envs.BREVO_API_KEY,
        brevoSenderEmail: options.delivery?.brevoSenderEmail ?? envs.BREVO_SENDER_EMAIL,
        operatorAlertEmail: envs.OPERATOR_ALERT_EMAIL,
        logger,
        correlationId,
      });
      emitStructuredLog(logger, 'warn', 'work.dlq_archived', {
        ...jobLogContext(correlationId, activeQueue, msgId, readCount, kind, message, startedAt),
        outcome: 'dlq_archived',
        event_id: archived?.event_id ?? null,
      });
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
          aiDailyTokenBudget: options.processing?.aiDailyTokenBudget ??
            parseConfiguredBudget(envs.AI_DAILY_TOKEN_BUDGET),
          aiResponseTokenBudget: options.processing?.aiResponseTokenBudget ??
            parseConfiguredBudget(envs.AI_RESPONSE_TOKEN_BUDGET),
          alerting: {
            fetchImpl: options.delivery?.fetchImpl,
            brevoApiKey: options.delivery?.brevoApiKey ?? envs.BREVO_API_KEY,
            brevoSenderEmail: options.delivery?.brevoSenderEmail ?? envs.BREVO_SENDER_EMAIL,
            operatorAlertEmail: envs.OPERATOR_ALERT_EMAIL,
            logger,
            correlationId,
          },
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

      emitStructuredLog(logger, 'info', 'work.completed', {
        ...jobLogContext(correlationId, activeQueue, msgId, readCount, kind, message, startedAt),
        outcome: 'completed',
      });
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

          emitStructuredLog(logger, 'info', 'work.delivery_skipped', {
            ...jobLogContext(
              correlationId,
              activeQueue,
              msgId,
              readCount,
              kind,
              message,
              startedAt,
            ),
            outcome: err.action === 'ack' ? 'completed' : 'delivery_requeued',
            error_code: err.code,
          });
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

        emitStructuredLog(
          logger,
          deliveryError.retryable ? 'error' : 'warn',
          'work.delivery_failed',
          {
            ...jobLogContext(
              correlationId,
              activeQueue,
              msgId,
              readCount,
              kind,
              message,
              startedAt,
            ),
            outcome: deliveryError.retryable ? 'failed' : 'delivery_failed_permanent',
            error_code: deliveryError.code,
          },
        );
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

      if (
        kind === 'processing' && err instanceof ProcessingWorkerError &&
        err.code === 'ai_budget_exhausted'
      ) {
        try {
          await failTerminalProcessingJob(
            supabaseAdmin,
            activeQueue,
            msgId,
            message,
            cycleDate,
            errMsg,
          );
        } catch (failureRecordErr: unknown) {
          const recordError = failureRecordErr instanceof Error
            ? failureRecordErr.message
            : 'Unknown terminal failure recording error';
          return json({
            status: 'failed',
            msg_id: msgId,
            error: errMsg,
            failure_record_error: recordError,
          }, 500);
        }

        emitStructuredLog(logger, 'warn', 'work.processing_failed_terminal', {
          ...jobLogContext(correlationId, activeQueue, msgId, readCount, kind, message, startedAt),
          outcome: 'processing_failed_terminal',
          error_code: err.code,
        });
        return json({ status: 'processing_failed_terminal', msg_id: msgId, error: errMsg });
      }

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

      emitStructuredLog(logger, 'error', 'work.failed', {
        ...jobLogContext(correlationId, activeQueue, msgId, readCount, kind, message, startedAt),
        outcome: 'failed',
        error_code: safeErrorCode(err),
      });
      return json({ status: 'failed', msg_id: msgId, error: errMsg }, 500);
    }
  };
