export class IngestionWorkerError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'IngestionWorkerError';
  }
}

export class ProcessingWorkerError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'ProcessingWorkerError';
  }
}

export class DeliveryWorkerError extends Error {
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

export class DeliveryWorkerSkip extends Error {
  constructor(
    public readonly code: string,
    public readonly action: 'ack' | 'requeue',
    public readonly delaySeconds: number | null = null,
  ) {
    super(code);
    this.name = 'DeliveryWorkerSkip';
  }
}

export const getErrorName = (error: unknown): string =>
  error && typeof error === 'object' && 'name' in error
    ? String((error as { name?: unknown }).name)
    : '';

export const safeErrorCode = (error: unknown): string => {
  if (error instanceof IngestionWorkerError) return error.code;
  if (error instanceof ProcessingWorkerError) return error.code;
  if (error instanceof DeliveryWorkerError) return error.code;
  if (getErrorName(error) === 'AbortError') return 'fetch_timeout';
  if (getErrorName(error) === 'SsrfProtectionError') return 'ssrf_blocked';
  return 'ingestion_failed';
};

export const safeErrorMessage = (error: unknown): string => safeErrorCode(error).replace(/_/g, ' ');
