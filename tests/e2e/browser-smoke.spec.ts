import { expect, test } from '@playwright/test';

test('browser shell loads the main panels', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: /News Aggregator/i })).toBeVisible();
  await expect(page.getByText(/Configure your daily AI-driven newsletter digest/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /Sign in with Google/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Sign in with GitHub/i })).toBeVisible();
  await expect(page.getByText(/or dev login/i)).toHaveCount(0);
});

test('unauthenticated protected dashboard routes show sign-in shell', async ({ page }) => {
  await page.goto('/dashboard/digests');

  await expect(page.getByRole('heading', { name: /News Aggregator/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Sign in with Google/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Daily intelligence control room/i })).toHaveCount(
    0,
  );
});

test('OAuth callback errors are surfaced without showing dashboard content', async ({ page }) => {
  await page.goto('/auth/callback?error_description=Provider%20denied%20access');

  await expect(page).toHaveURL('/');
  await expect(page.getByText(/Authentication failed: Provider denied access/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /Sign in with GitHub/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Daily intelligence control room/i })).toHaveCount(
    0,
  );
});

test('OAuth callback errors take precedence over existing fixture sessions', async ({ page }) => {
  await page.goto('/auth/callback?fixture=dashboard&error_description=Provider%20denied%20access');

  await expect(page).toHaveURL('/');
  await expect(page.getByText(/Authentication failed: Provider denied access/i)).toBeVisible();
  await expect(page.getByRole('heading', { name: /Daily intelligence control room/i })).toHaveCount(
    0,
  );
});

test('OAuth-like error parameters outside the callback route are ignored', async ({ page }) => {
  await page.goto('/dashboard?fixture=dashboard&error_description=Provider%20denied%20access');

  await expect(
    page.getByRole('heading', { name: /Daily intelligence control room/i }),
  ).toBeVisible();
  await expect(page.getByText(/Authentication failed/i)).toHaveCount(0);
});

test('authenticated dashboard shows operational overview on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/dashboard?fixture=dashboard');

  await expect(
    page.getByRole('heading', { name: /Daily intelligence control room/i }),
  ).toBeVisible();
  await expect(page.getByText(/Morning policy brief/i)).toBeVisible();
  await expect(page.getByText('Markets and policy brief', { exact: true })).toBeVisible();
  await expect(page.getByText('Source warnings', { exact: true })).toBeVisible();
  await expect(page.getByText(/https:\/\/example\.com\/research-feed/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /Open digests/i })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});

test('authenticated callback and deep links restore the dashboard route', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/auth/callback?fixture=dashboard');

  await expect(page).toHaveURL('/dashboard');
  await expect(
    page.getByRole('heading', { name: /Daily intelligence control room/i }),
  ).toBeVisible();

  await page.goto('/dashboard/digests?fixture=dashboard');
  await expect(page.getByRole('heading', { name: /Digest feedback/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Digests', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('authenticated logout returns to the sign-in shell', async ({ page }) => {
  await page.goto('/dashboard?fixture=dashboard');

  await expect(
    page.getByRole('heading', { name: /Daily intelligence control room/i }),
  ).toBeVisible();
  await page.getByRole('button', { name: /Log out/i }).click();

  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { name: /News Aggregator/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Daily intelligence control room/i })).toHaveCount(
    0,
  );
});

test('logout clears local dashboard UI even when remote sign-out fails', async ({ page }) => {
  await page.goto('/dashboard?fixture=dashboard&signout=fail');

  await expect(
    page.getByRole('heading', { name: /Daily intelligence control room/i }),
  ).toBeVisible();
  await page.getByRole('button', { name: /Log out/i }).click();

  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { name: /News Aggregator/i })).toBeVisible();
  await expect(page.getByText(/Remote sign-out failed: fixture sign-out failure/i)).toBeVisible();
  await expect(page.getByRole('heading', { name: /Daily intelligence control room/i })).toHaveCount(
    0,
  );
});

test('authenticated dashboard and digest feedback stay usable on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/dashboard?fixture=dashboard');

  await expect(page.getByRole('navigation', { name: /Dashboard sections/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Digests', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Open digests/i }).click();

  await expect(page.getByRole('heading', { name: /Digest feedback/i })).toBeVisible();
  await expect(page.getByText(/Morning policy brief/i)).toBeVisible();
  await expect(page.getByText(/Policy teams signaled a slower path for cuts/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /Rate digest thumbs up/i }).first()).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);

  for (const tab of ['Preferences', 'Sources', 'Flows', 'Delivery', 'Digests']) {
    await page.getByRole('button', { name: tab, exact: true }).click();
    await page.waitForTimeout(100);
    const tabOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(tabOverflow, `${tab} tab should not overflow mobile viewport`).toBe(false);
  }
});
