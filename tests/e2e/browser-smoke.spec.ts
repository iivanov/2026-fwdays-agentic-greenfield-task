import { expect, test } from '@playwright/test';

test('browser shell loads the main panels', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: /News Aggregator/i })).toBeVisible();
  await expect(page.getByText(/Configure your daily AI-driven newsletter digest/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /Sign in with Google/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Sign in with GitHub/i })).toBeVisible();
  await expect(page.getByText(/or dev login/i)).toBeVisible();
});

test('authenticated dashboard shows operational overview on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/?fixture=dashboard');

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

test('authenticated dashboard and digest feedback stay usable on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/?fixture=dashboard');

  await expect(page.getByRole('navigation', { name: /Dashboard sections/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Digests', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Open digests/i }).click();

  await expect(page.getByRole('heading', { name: /Digest feedback/i })).toBeVisible();
  await expect(page.getByText(/Morning policy brief/i)).toBeVisible();
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
