const LOCAL_SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';

try {
  const response = await fetch(`${LOCAL_SUPABASE_URL}/auth/v1/health`, {
    signal: AbortSignal.timeout(5_000),
  });

  if (!response.ok) {
    throw new Error(`health endpoint returned HTTP ${response.status}`);
  }
} catch (error) {
  const reason = error instanceof Error ? error.message : String(error);
  throw new Error(
    `Supabase integration prerequisites failed: local Supabase is not healthy at ${LOCAL_SUPABASE_URL}. ` +
      `Run "npm run supabase:start" and "npm run supabase:reset" before "npm run test:integration:supabase". ` +
      `Reason: ${reason}`,
    { cause: error },
  );
}
