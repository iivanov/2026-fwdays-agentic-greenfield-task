import { useState, useEffect, type FormEvent } from 'react';
import { supabase } from './lib/supabase.js';
import ProfilePanel from './components/ProfilePanel.js';
import SourcesPanel from './components/SourcesPanel.js';
import FlowsPanel from './components/FlowsPanel.js';
import DeliveryPanel from './components/DeliveryPanel.js';
import DigestFeedbackPanel from './components/DigestFeedbackPanel.js';
import DashboardOverview, { dashboardFixture } from './components/DashboardOverview.js';
import { type Session } from '@supabase/supabase-js';
import {
  authReturnStorageKey,
  dashboardPathForTab,
  dashboardTabFromPath,
  dashboardTabs,
  getOAuthCallbackError,
  isAuthCallbackPath,
  isDashboardPath,
  safeDashboardReturnPath,
  shouldShowDevPasswordAuth,
  type DashboardTab,
} from './lib/auth-routing.js';

const e2eFixtureMode = isE2eFixtureMode();
const showLocalPasswordAuth = shouldShowDevPasswordAuth(
  import.meta.env.DEV,
  import.meta.env.VITE_ENABLE_DEV_PASSWORD_AUTH,
);

const fixtureSession = {
  access_token: 'fixture-access-token',
  refresh_token: 'fixture-refresh-token',
  expires_in: 3600,
  token_type: 'bearer',
  user: {
    id: 'fixture-user',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'editor@example.com',
    app_metadata: {},
    user_metadata: {},
    created_at: '2026-07-05T00:00:00.000Z',
  },
} as Session;

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [activeTab, setActiveTab] = useState<DashboardTab>(() =>
    dashboardTabFromPath(window.location.pathname),
  );
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(() => initialCallbackErrorMessage());
  const [authStatusText, setAuthStatusText] = useState(() =>
    isAuthCallbackPath(window.location.pathname)
      ? 'Restoring your secure session...'
      : 'Loading session...',
  );
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    if (e2eFixtureMode) {
      setSession(fixtureSession);
      setActiveTab(dashboardTabFromPath(window.location.pathname));
      if (isAuthCallbackPath(window.location.pathname)) {
        replacePath('/dashboard');
      }
      setLoading(false);
      return;
    }

    let callbackFailed = false;
    const callbackError = currentCallbackError();
    if (callbackError) {
      callbackFailed = true;
      setLoginError(`Authentication failed: ${callbackError}`);
      clearStoredReturnPath();
      setSession(null);
      replacePath('/');
    } else if (isAuthCallbackPath(window.location.pathname)) {
      setAuthStatusText('Restoring your secure session...');
    } else if (isDashboardPath(window.location.pathname)) {
      storeReturnPath(safeDashboardReturnPath(window.location.pathname));
    }

    const applySession = (nextSession: Session | null) => {
      setSession(nextSession);
      setIsSigningOut(false);

      if (nextSession) {
        setLoginError(null);
        const targetPath = readStoredReturnPath() ?? currentDashboardPath();
        clearStoredReturnPath();
        setActiveTab(dashboardTabFromPath(targetPath));

        if (
          !isDashboardPath(window.location.pathname) ||
          isAuthCallbackPath(window.location.pathname)
        ) {
          replacePath(targetPath);
        }
      } else if (isDashboardPath(window.location.pathname)) {
        storeReturnPath(safeDashboardReturnPath(window.location.pathname));
        setActiveTab(dashboardTabFromPath(window.location.pathname));
      }

      setLoading(false);
    };

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) {
          setLoginError(error.message);
        }
        applySession(callbackFailed ? null : data.session);
      })
      .catch((err: unknown) => {
        setLoginError(err instanceof Error ? err.message : 'Failed to restore session.');
        applySession(null);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: string, nextSession: Session | null) => {
      if (event === 'SIGNED_OUT') {
        clearStoredReturnPath();
        setActiveTab('overview');
        replacePath('/');
      }
      applySession(nextSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setActiveTab(dashboardTabFromPath(window.location.pathname));
      if (!session && isDashboardPath(window.location.pathname)) {
        storeReturnPath(safeDashboardReturnPath(window.location.pathname));
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [session]);

  const handleOAuthLogin = async (provider: 'google' | 'github') => {
    try {
      setLoginError(null);
      storeReturnPath(
        safeDashboardReturnPath(window.location.pathname) ?? readStoredReturnPath() ?? '/dashboard',
      );
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : 'Failed to initiate OAuth login.');
    }
  };

  const handleLocalSignIn = async (e: FormEvent) => {
    e.preventDefault();
    if (!showLocalPasswordAuth) {
      return;
    }
    try {
      setLoginError(null);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : 'Failed to sign in.');
    }
  };

  const handleLocalSignUp = async () => {
    if (!showLocalPasswordAuth) {
      return;
    }

    try {
      setLoginError(null);
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) throw error;
      alert('Sign up successful! Please log in.');
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : 'Failed to sign up.');
    }
  };

  const handleLogout = async () => {
    const simulateFixtureSignOutFailure =
      e2eFixtureMode && new URLSearchParams(window.location.search).get('signout') === 'fail';
    setIsSigningOut(true);
    setLoginError(null);
    clearStoredReturnPath();
    setActiveTab('overview');
    replacePath('/');
    setSession(null);
    if (e2eFixtureMode) {
      if (simulateFixtureSignOutFailure) {
        setLoginError('Remote sign-out failed: fixture sign-out failure');
      }
      setIsSigningOut(false);
      return;
    }

    const { error } = await supabase.auth.signOut();
    if (error) {
      setLoginError(`Remote sign-out failed: ${error.message}`);
      setIsSigningOut(false);
      return;
    }
  };

  const handleTabChange = (tab: DashboardTab) => {
    setActiveTab(tab);
    if (session) {
      pushPath(dashboardPathForTab(tab));
    }
  };

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          height: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div className="spinner">{authStatusText}</div>
      </div>
    );
  }

  // Login Screen (Mockup + Local developer login capabilities)
  if (!session) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background:
            'radial-gradient(circle at 10% 20%, hsl(224 25% 15%) 0%, hsl(224 25% 10%) 90%)',
        }}
      >
        <div
          className="glass-panel"
          style={{
            maxWidth: '440px',
            width: '100%',
            padding: '40px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <h1
              style={{
                fontSize: '2rem',
                marginBottom: '8px',
                background: 'var(--accent-gradient)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              News Aggregator
            </h1>
            <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem' }}>
              Configure your daily AI-driven newsletter digest.
            </p>
          </div>

          {loginError && (
            <div
              style={{
                background: 'rgba(220, 38, 38, 0.15)',
                border: '1px dashed hsl(var(--danger))',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                color: 'hsl(var(--danger))',
              }}
            >
              {loginError}
            </div>
          )}

          {/* Social Logins */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              onClick={() => handleOAuthLogin('google')}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid hsl(var(--border-color))',
                background: 'rgba(255,255,255,0.03)',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
            >
              Sign in with Google
            </button>
            <button
              onClick={() => handleOAuthLogin('github')}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid hsl(var(--border-color))',
                background: 'rgba(255,255,255,0.03)',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
            >
              Sign in with GitHub
            </button>
          </div>

          {showLocalPasswordAuth ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <hr style={{ flex: 1, borderColor: 'rgba(255,255,255,0.08)' }} />
                <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>
                  or dev login
                </span>
                <hr style={{ flex: 1, borderColor: 'rgba(255,255,255,0.08)' }} />
              </div>

              <form
                onSubmit={handleLocalSignIn}
                style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
              >
                <div>
                  <label
                    style={{
                      fontSize: '0.8rem',
                      color: 'hsl(var(--text-secondary))',
                      display: 'block',
                      marginBottom: '6px',
                    }}
                  >
                    Email address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid hsl(var(--border-color))',
                      background: 'hsl(var(--bg-secondary))',
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      fontSize: '0.8rem',
                      color: 'hsl(var(--text-secondary))',
                      display: 'block',
                      marginBottom: '6px',
                    }}
                  >
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid hsl(var(--border-color))',
                      background: 'hsl(var(--bg-secondary))',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <button
                    type="submit"
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '8px',
                      border: 'none',
                      background: 'var(--accent-gradient)',
                      color: '#ffffff',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Log In
                  </button>
                  <button
                    type="button"
                    onClick={handleLocalSignUp}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid hsl(var(--border-color))',
                      background: 'transparent',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Sign Up
                  </button>
                </div>
              </form>
            </>
          ) : null}
        </div>
      </main>
    );
  }

  // Authenticated Dashboard
  return (
    <div className="app-shell">
      <header className="app-masthead">
        <div className="masthead-brand">
          <p className="eyebrow">AI news desk</p>
          <h2>News Personalization</h2>
        </div>
        <nav className="tab-nav" aria-label="Dashboard sections">
          {dashboardTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-current={activeTab === tab.id ? 'page' : undefined}
              className={`tab-button${activeTab === tab.id ? ' tab-button--active' : ''}`}
              onClick={() => handleTabChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="account-strip">
          <span>{session.user.email}</span>
          <button className="secondary-button" onClick={handleLogout} disabled={isSigningOut}>
            {isSigningOut ? 'Signing out...' : 'Log out'}
          </button>
        </div>
      </header>

      <main className="app-content">
        {activeTab === 'overview' ? (
          <DashboardOverview
            session={session}
            fixture={e2eFixtureMode ? dashboardFixture : undefined}
            onOpenTab={handleTabChange}
          />
        ) : activeTab === 'profile' ? (
          <ProfilePanel session={session} />
        ) : activeTab === 'sources' ? (
          <SourcesPanel session={session} />
        ) : activeTab === 'flows' ? (
          <FlowsPanel session={session} />
        ) : activeTab === 'delivery' ? (
          <DeliveryPanel session={session} />
        ) : (
          <DigestFeedbackPanel
            session={session}
            fixtureReport={e2eFixtureMode ? dashboardFixture.digestReport : undefined}
          />
        )}
      </main>
    </div>
  );
}

function isE2eFixtureMode(): boolean {
  return (
    import.meta.env.MODE === 'e2e' &&
    import.meta.env.VITE_E2E_DASHBOARD_FIXTURE === '1' &&
    !currentCallbackError() &&
    new URLSearchParams(window.location.search).get('fixture') === 'dashboard'
  );
}

function currentCallbackError(): string | null {
  if (!isAuthCallbackPath(window.location.pathname)) {
    return null;
  }

  return getOAuthCallbackError(window.location.search, window.location.hash);
}

function initialCallbackErrorMessage(): string | null {
  const callbackError = currentCallbackError();
  return callbackError ? `Authentication failed: ${callbackError}` : null;
}

function currentDashboardPath(): string {
  return safeDashboardReturnPath(window.location.pathname) ?? '/dashboard';
}

function readStoredReturnPath(): string | null {
  try {
    return safeDashboardReturnPath(window.sessionStorage.getItem(authReturnStorageKey));
  } catch {
    return null;
  }
}

function storeReturnPath(path: string | null): void {
  const safePath = safeDashboardReturnPath(path);
  if (!safePath) {
    return;
  }

  try {
    window.sessionStorage.setItem(authReturnStorageKey, safePath);
  } catch {
    // Ignore storage failures; routing still falls back to /dashboard.
  }
}

function clearStoredReturnPath(): void {
  try {
    window.sessionStorage.removeItem(authReturnStorageKey);
  } catch {
    // Ignore storage failures; session state still changes.
  }
}

function pushPath(path: string): void {
  if (window.location.pathname !== path) {
    window.history.pushState(null, '', path);
  }
}

function replacePath(path: string): void {
  if (window.location.pathname !== path) {
    window.history.replaceState(null, '', path);
  }
}
