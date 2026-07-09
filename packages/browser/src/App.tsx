import { useState, useEffect, type FormEvent } from 'react';
import { isSupabaseConfigured, supabase } from './lib/supabase.js';
import newsDeskHero from './assets/news-desk-hero.png';
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
const supabaseConfigured = isSupabaseConfigured();
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

    if (!supabaseConfigured) {
      setLoading(false);
      return;
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
      if (!supabaseConfigured) {
        throw new Error('Supabase browser environment variables are not configured for sign-in.');
      }
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
      if (!supabaseConfigured) {
        throw new Error('Supabase browser environment variables are not configured for sign-in.');
      }
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
      if (!supabaseConfigured) {
        throw new Error('Supabase browser environment variables are not configured for sign-up.');
      }
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

    if (!supabaseConfigured) {
      setLoginError('Remote sign-out failed: Supabase browser environment is not configured.');
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

  // Public landing page plus local developer login capabilities.
  if (!session) {
    return (
      <main className="landing-page">
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-hero__copy">
            <p className="eyebrow">AI news desk</p>
            <h1 id="landing-title">Source-backed daily briefings without the tab sprawl.</h1>
            <p className="landing-hero__lede">
              Connect trusted feeds and article URLs, tune the prompt once, and receive one
              controlled digest across the channels your team already checks.
            </p>

            {loginError && (
              <div className="auth-error" role="alert">
                {loginError}
              </div>
            )}

            <div className="landing-actions" aria-label="Sign in options">
              <button
                className="landing-button landing-button--primary"
                onClick={() => handleOAuthLogin('google')}
              >
                Sign in with Google
              </button>
              <button className="landing-button" onClick={() => handleOAuthLogin('github')}>
                Sign in with GitHub
              </button>
            </div>

            <dl className="landing-proof">
              <div>
                <dt>5</dt>
                <dd>flows per user</dd>
              </div>
              <div>
                <dt>06:00</dt>
                <dd>UTC digest window</dd>
              </div>
              <div>
                <dt>7 days</dt>
                <dd>content retention</dd>
              </div>
            </dl>
          </div>

          <figure className="landing-hero__visual">
            <img
              src={newsDeskHero}
              alt="Editorial desk showing source cards flowing into one daily digest"
            />
          </figure>
        </section>

        <section className="landing-workflow" aria-label="Digest workflow">
          <article>
            <span>Source intake</span>
            <h2>Bring RSS feeds and articles into one controlled queue.</h2>
            <p>
              Shared fetching keeps duplicate source work low while health checks flag feeds that
              need attention.
            </p>
          </article>
          <article>
            <span>AI brief</span>
            <h2>Summaries follow your language, interests, and prompt rules.</h2>
            <p>
              The pipeline truncates inputs before AI processing and stores digest feedback for
              operator review.
            </p>
          </article>
          <article>
            <span>Delivery</span>
            <h2>Send one digest to in-app, email, Telegram, Slack, or webhook.</h2>
            <p>
              Delivery secrets stay encrypted, generic webhooks are signed, and retries remain
              durable outside the browser.
            </p>
          </article>
        </section>

        <section className="landing-demo" aria-labelledby="landing-demo-title">
          <div className="landing-demo__copy">
            <p className="eyebrow">project demo</p>
            <h2 id="landing-demo-title">Watch the 81-second build walkthrough.</h2>
            <p>
              The video shows the product surface and the agentic engineering loop behind it:
              requirements, OpenSpec slices, maker/checker passes, and retained verification
              evidence.
            </p>
          </div>
          <div className="landing-demo__frame" role="group" aria-label="Project demo video frame">
            <video controls preload="metadata" aria-label="Project demo video">
              <source src="/demo-video.webm" type="video/webm" />
              <a href="/demo-video.webm">Download the project demo video.</a>
            </video>
          </div>
        </section>

        {showLocalPasswordAuth ? (
          <section className="dev-login" aria-label="Local development login">
            <p className="eyebrow">or dev login</p>
            <form onSubmit={handleLocalSignIn}>
              <label>
                <span>Email address</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>

              <label>
                <span>Password</span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>

              <div className="dev-login__actions">
                <button className="landing-button landing-button--primary" type="submit">
                  Log In
                </button>
                <button className="landing-button" type="button" onClick={handleLocalSignUp}>
                  Sign Up
                </button>
              </div>
            </form>
          </section>
        ) : null}
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
