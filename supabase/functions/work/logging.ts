import type { JobPayload, LogLevel, SafeLogger, WorkerKind } from './types.ts';

export const getWorkerKind = (queueName: string, message: JobPayload): WorkerKind | null => {
  if (queueName === 'ingestion-queue' || message.type === 'ingestion') return 'ingestion';
  if (queueName === 'processing-queue' || message.type === 'processing') return 'processing';
  if (queueName === 'delivery-queue' || message.type === 'delivery') return 'delivery';
  return null;
};

export const sanitizeDlqContext = (queue: string, message: JobPayload) => ({
  queue,
  type: message.type ?? null,
  source_id: message.source_id ?? null,
  flow_id: message.flow_id ?? null,
  attempt_id: message.attempt_id ?? null,
  cycle_date: message.cycle_date ?? null,
});

export const safeLogValue = (value: unknown): unknown => {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (Array.isArray(value)) return value.map(safeLogValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) =>
          !/(content|body|prompt|token|secret|credential|config|webhook_url|api[_-]?key)/i
            .test(key)
        )
        .map(([key, nested]) => [key, safeLogValue(nested)]),
    );
  }
  return String(value);
};

export const emitStructuredLog = (
  logger: SafeLogger,
  level: LogLevel,
  event: string,
  context: Record<string, unknown>,
) => {
  const payload = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...(safeLogValue(context) as Record<string, unknown>),
  };
  logger[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](JSON.stringify(payload));
};

export const jobLogContext = (
  correlationId: string,
  queue: string,
  msgId: string | number | null,
  readCount: number | null,
  kind: WorkerKind | null,
  message: JobPayload,
  startedAt: number,
) => ({
  correlation_id: correlationId,
  queue,
  msg_id: msgId,
  read_count: readCount,
  job_type: kind,
  source_id: message.source_id ?? null,
  flow_id: message.flow_id ?? null,
  attempt_id: message.attempt_id ?? null,
  cycle_date: message.cycle_date ?? null,
  duration_ms: Date.now() - startedAt,
});
