import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// Standard Supabase local emulator credentials
const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321';
const LOCAL_SERVICE_KEY =
  'local-service-role-fixture';

interface Profile {
  id: string;
  email: string;
}

interface DeliveryChannel {
  id: string;
  user_id: string;
  type: string;
  status: string;
  verified_at: string | null;
  config: Record<string, unknown>;
}

describe('Supabase Auth Database Triggers Integration Test', () => {
  let supabaseAdmin: ReturnType<typeof createClient> | null = null;
  let isDbRunning = false;

  beforeAll(async () => {
    // Check if the local Supabase auth emulator is healthy
    try {
      const res = await fetch(`${LOCAL_SUPABASE_URL}/auth/v1/health`);
      if (res.ok) {
        supabaseAdmin = createClient(LOCAL_SUPABASE_URL, LOCAL_SERVICE_KEY, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        });
        isDbRunning = true;
      }
    } catch {
      // Supabase auth is not running/healthy, skip tests
      isDbRunning = false;
    }
  });

  it('should verify profile and channel auto-provisioning trigger if DB is running', async () => {
    if (!isDbRunning || !supabaseAdmin) {
      throw new Error(
        'Supabase integration prerequisites were not met after setup. Run "npm run supabase:start" and "npm run supabase:reset", then rerun "npm run test:integration".',
      );
    }

    const testEmail = `test-${Date.now()}@example.com`;
    const testPassword = 'super-secure-password-123';

    // 1. Clean up any existing test users with this email pattern
    const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    expect(listError).toBeNull();
    if (existingUsers?.users) {
      for (const u of existingUsers.users) {
        if (u.email?.startsWith('test-')) {
          await supabaseAdmin.auth.admin.deleteUser(u.id);
        }
      }
    }

    // 2. Create a new user using the admin client (simulating user signup)
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true, // Mark email as verified
    });

    expect(createError).toBeNull();
    expect(newUser.user).toBeDefined();
    const userId = newUser.user!.id;

    // 3. Verify profile exists
    const { data: profile, error: profileError } = (await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()) as { data: Profile | null; error: unknown };

    expect(profileError).toBeNull();
    expect(profile).toBeDefined();
    expect(profile!.email).toBe(testEmail);

    // 4. Verify default delivery channels are created
    const { data: channels, error: channelsError } = (await supabaseAdmin
      .from('delivery_channels')
      .select('*')
      .eq('user_id', userId)) as {
      data: DeliveryChannel[] | null;
      error: unknown;
    };

    expect(channelsError).toBeNull();
    expect(channels).toHaveLength(2);

    const inAppChannel = channels?.find((c) => c.type === 'in-app');
    const emailChannel = channels?.find((c) => c.type === 'email');

    expect(inAppChannel).toBeDefined();
    expect(inAppChannel!.status).toBe('active');

    expect(emailChannel).toBeDefined();
    expect(emailChannel!.status).toBe('active'); // Since we passed email_confirm: true
    expect(emailChannel!.verified_at).not.toBeNull();
    expect(emailChannel!.config).toEqual({ email: testEmail });

    // 5. Clean up
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    expect(deleteError).toBeNull();
  });

  it('should verify profile and channel updates on email changes and confirmations', async () => {
    if (!isDbRunning || !supabaseAdmin) {
      throw new Error(
        'Supabase integration prerequisites were not met after setup. Run "npm run supabase:start" and "npm run supabase:reset", then rerun "npm run test:integration".',
      );
    }

    const testEmail = `test-update-${Date.now()}@example.com`;
    const updatedEmail = `test-new-${Date.now()}@example.com`;
    const testPassword = 'super-secure-password-123';

    // 1. Create a user with unconfirmed email
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: false,
    });

    expect(createError).toBeNull();
    const userId = newUser.user!.id;

    // Verify channel is pending
    const { data: channels1 } = (await supabaseAdmin
      .from('delivery_channels')
      .select('*')
      .eq('user_id', userId)) as { data: DeliveryChannel[] | null };

    const emailChannel1 = channels1?.find((c) => c.type === 'email');
    expect(emailChannel1).toBeDefined();
    expect(emailChannel1!.status).toBe('pending');
    expect(emailChannel1!.verified_at).toBeNull();

    // 2. Confirm the email address via update
    const { error: confirmError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      email_confirm: true,
    });
    expect(confirmError).toBeNull();

    // Verify channel becomes active
    const { data: channels2 } = (await supabaseAdmin
      .from('delivery_channels')
      .select('*')
      .eq('user_id', userId)) as { data: DeliveryChannel[] | null };

    const emailChannel2 = channels2?.find((c) => c.type === 'email');
    expect(emailChannel2!.status).toBe('active');
    expect(emailChannel2!.verified_at).not.toBeNull();

    // 3. Update to a new email address (which immediately changes email in auth.users via admin API)
    const { error: updateEmailError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      email: updatedEmail,
    });
    expect(updateEmailError).toBeNull();

    // Verify profile email has updated
    const { data: profile } = (await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()) as { data: Profile | null };

    expect(profile!.email).toBe(updatedEmail);

    // Verify channel config is updated, and status remains active since email_confirmed_at is still non-null
    const { data: channels3 } = (await supabaseAdmin
      .from('delivery_channels')
      .select('*')
      .eq('user_id', userId)) as { data: DeliveryChannel[] | null };

    const emailChannel3 = channels3?.find((c) => c.type === 'email');
    expect(emailChannel3!.config).toEqual({ email: updatedEmail });
    expect(emailChannel3!.status).toBe('active');
    expect(emailChannel3!.verified_at).not.toBeNull();

    // Clean up
    await supabaseAdmin.auth.admin.deleteUser(userId);
  });
});
