import { describe, expect, it } from 'vitest';
import {
  dashboardPathForTab,
  dashboardTabFromPath,
  getOAuthCallbackError,
  isAuthCallbackPath,
  isDashboardPath,
  safeDashboardReturnPath,
  shouldShowDevPasswordAuth,
} from './auth-routing.js';

describe('browser auth routing helpers', () => {
  it('maps dashboard paths to known tabs and normalizes unknown tabs', () => {
    expect(isDashboardPath('/dashboard')).toBe(true);
    expect(isDashboardPath('/dashboard/digests')).toBe(true);
    expect(isDashboardPath('/auth/callback')).toBe(false);
    expect(dashboardTabFromPath('/dashboard')).toBe('overview');
    expect(dashboardTabFromPath('/dashboard/sources')).toBe('sources');
    expect(dashboardTabFromPath('/dashboard/unknown')).toBe('overview');
    expect(dashboardPathForTab('overview')).toBe('/dashboard');
    expect(dashboardPathForTab('digests')).toBe('/dashboard/digests');
  });

  it('detects the OAuth callback route with or without a trailing slash', () => {
    expect(isAuthCallbackPath('/auth/callback')).toBe(true);
    expect(isAuthCallbackPath('/auth/callback/')).toBe(true);
    expect(isAuthCallbackPath('/dashboard')).toBe(false);
  });

  it('accepts only same-origin-style dashboard return paths', () => {
    expect(safeDashboardReturnPath('/dashboard/flows')).toBe('/dashboard/flows');
    expect(safeDashboardReturnPath('/dashboard/unknown')).toBe('/dashboard');
    expect(safeDashboardReturnPath('/dashboard/digests?fixture=dashboard')).toBe(
      '/dashboard/digests',
    );
    expect(safeDashboardReturnPath('https://evil.example/dashboard')).toBeNull();
    expect(safeDashboardReturnPath('//evil.example/dashboard')).toBeNull();
    expect(safeDashboardReturnPath('/auth/callback?code=abc')).toBeNull();
    expect(safeDashboardReturnPath('javascript:alert(1)')).toBeNull();
  });

  it('sanitizes OAuth callback errors from query or hash parameters', () => {
    expect(getOAuthCallbackError('?error_description=Access%20denied', '')).toBe('Access denied');
    expect(getOAuthCallbackError('', '#error=%3Cbad%3E')).toBe('bad');
    expect(getOAuthCallbackError('', '')).toBeNull();
  });

  it('keeps password auth behind local development or an explicit flag', () => {
    expect(shouldShowDevPasswordAuth(true, undefined)).toBe(true);
    expect(shouldShowDevPasswordAuth(false, '1')).toBe(true);
    expect(shouldShowDevPasswordAuth(false, 'true')).toBe(false);
    expect(shouldShowDevPasswordAuth(false, undefined)).toBe(false);
  });
});
