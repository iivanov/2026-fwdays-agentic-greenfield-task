const LEGACY_LOCAL_SERVICE_ROLE_KEY =
  'local-service-role-fixture';

export const LOCAL_SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.API_URL ?? 'http://127.0.0.1:54321';

export const LOCAL_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SERVICE_ROLE_KEY ??
  process.env.SECRET_KEY ??
  LEGACY_LOCAL_SERVICE_ROLE_KEY;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function probeSupabaseHealth(): Promise<void> {
  const response = await fetch(`${LOCAL_SUPABASE_URL}/auth/v1/health`, {
    signal: AbortSignal.timeout(5_000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `health endpoint returned HTTP ${response.status}${body ? `: ${body.slice(0, 200)}` : ''}`,
    );
  }
}

export async function waitForSupabaseHealth(timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  do {
    try {
      await probeSupabaseHealth();
      return;
    } catch (error) {
      lastError = error;
      await delay(1_000);
    }
  } while (Date.now() < deadline);

  const reason = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(
    `Supabase integration prerequisites failed: local Supabase is not healthy at ${LOCAL_SUPABASE_URL}. ` +
      `Run "npm run supabase:start" and "npm run supabase:reset" before "npm run test:integration:supabase". ` +
      `Reason: ${reason}`,
    { cause: lastError },
  );
}
