export type DashboardTab = 'overview' | 'profile' | 'sources' | 'flows' | 'delivery' | 'digests';

export const dashboardTabs: Array<{ id: DashboardTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'profile', label: 'Preferences' },
  { id: 'sources', label: 'Sources' },
  { id: 'flows', label: 'Flows' },
  { id: 'delivery', label: 'Delivery' },
  { id: 'digests', label: 'Digests' },
];

const dashboardTabSet = new Set<DashboardTab>(dashboardTabs.map((tab) => tab.id));
const fallbackOrigin = 'https://news-aggregator.local';

export const authReturnStorageKey = 'news-aggregator.auth.returnPath';

export function isAuthCallbackPath(pathname: string): boolean {
  return stripTrailingSlash(pathname) === '/auth/callback';
}

export function isDashboardPath(pathname: string): boolean {
  const normalized = stripTrailingSlash(pathname);
  return normalized === '/dashboard' || normalized.startsWith('/dashboard/');
}

export function dashboardTabFromPath(pathname: string): DashboardTab {
  if (!isDashboardPath(pathname)) {
    return 'overview';
  }

  const [, , tab] = stripTrailingSlash(pathname).split('/');
  return isDashboardTab(tab) ? tab : 'overview';
}

export function dashboardPathForTab(tab: DashboardTab): string {
  return tab === 'overview' ? '/dashboard' : `/dashboard/${tab}`;
}

export function safeDashboardReturnPath(rawPath: string | null | undefined): string | null {
  if (!rawPath) {
    return null;
  }

  const trimmed = rawPath.trim();
  if (!trimmed || trimmed.startsWith('//')) {
    return null;
  }

  try {
    const parsed = new URL(trimmed, fallbackOrigin);
    if (parsed.origin !== fallbackOrigin && !trimmed.startsWith('/')) {
      return null;
    }

    if (!isDashboardPath(parsed.pathname)) {
      return null;
    }

    return dashboardPathForTab(dashboardTabFromPath(parsed.pathname));
  } catch {
    return null;
  }
}

export function getOAuthCallbackError(search: string, hash: string): string | null {
  const params = new URLSearchParams(search);
  const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  const error =
    params.get('error_description') ??
    hashParams.get('error_description') ??
    params.get('error') ??
    hashParams.get('error');

  if (!error) {
    return null;
  }

  return sanitizeAuthMessage(error);
}

export function shouldShowDevPasswordAuth(
  isDev: boolean,
  explicitFlag: string | undefined,
): boolean {
  return isDev || explicitFlag === '1';
}

function isDashboardTab(value: string | undefined): value is DashboardTab {
  return Boolean(value && dashboardTabSet.has(value as DashboardTab));
}

function stripTrailingSlash(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

function sanitizeAuthMessage(message: string): string {
  return message.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 180);
}
