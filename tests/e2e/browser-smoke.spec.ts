import { expect, test } from '@playwright/test';

test('browser shell loads the main panels', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: /News Aggregator/i })).toBeVisible();
  await expect(page.getByText(/Configure your daily AI-driven newsletter digest/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /Sign in with Google/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Sign in with GitHub/i })).toBeVisible();
  await expect(page.getByText(/or dev login/i)).toBeVisible();
});
