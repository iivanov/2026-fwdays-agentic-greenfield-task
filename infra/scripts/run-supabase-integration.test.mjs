import { describe, expect, it } from 'vitest';
import { parseLocalSupabaseStatus } from './run-supabase-integration.mjs';

describe('parseLocalSupabaseStatus', () => {
  it('maps the CLI API URL and service-role values', () => {
    expect(
      parseLocalSupabaseStatus(
        'API_URL="http://127.0.0.1:54321"\nSERVICE_ROLE_KEY="local-service-role-fixture"\n',
      ),
    ).toEqual({
      apiUrl: 'http://127.0.0.1:54321',
      serviceRoleKey: 'local-service-role-fixture',
    });
  });

  it('rejects incomplete CLI output without including values in its error', () => {
    expect(() => parseLocalSupabaseStatus('API_URL=http://127.0.0.1:54321\n')).toThrow(
      'required local integration credentials',
    );
  });
});
