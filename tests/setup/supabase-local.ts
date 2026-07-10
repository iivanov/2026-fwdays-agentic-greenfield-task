function requireIntegrationEnv(name: 'SUPABASE_URL' | 'SUPABASE_SERVICE_ROLE_KEY'): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Supabase integration prerequisites failed: ${name} is unavailable. ` +
        'Run "npm run test:integration" after "npm run supabase:start" and "npm run supabase:reset".',
    );
  }
  return value;
}

export const LOCAL_SUPABASE_URL = requireIntegrationEnv('SUPABASE_URL');
export const LOCAL_SERVICE_KEY = requireIntegrationEnv('SUPABASE_SERVICE_ROLE_KEY');

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
