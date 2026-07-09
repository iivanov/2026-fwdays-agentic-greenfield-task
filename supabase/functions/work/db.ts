import type { SupabaseAdmin } from './types.ts';

export const assertRpcOk = <T>(
  result: { data: T; error: { message: string } | null },
  label: string,
) => {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }
  return result.data;
};

export const selectSingle = async <T>(
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

export const selectRows = async <T>(
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

export const insertRows = async (
  supabaseAdmin: SupabaseAdmin,
  table: string,
  payload: Record<string, unknown> | Record<string, unknown>[],
) => {
  const query = supabaseAdmin.from(table).insert?.(payload);
  if (!query) throw new Error(`Table ${table} does not support insert`);
  const result = await query;
  if (result.error) throw new Error(result.error.message);
};

export const isUniqueClaimError = (error: unknown): boolean =>
  error instanceof Error &&
  /duplicate key|unique constraint|violates unique/i.test(error.message);
