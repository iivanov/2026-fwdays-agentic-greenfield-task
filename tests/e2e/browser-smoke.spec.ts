import { expect, test } from '@playwright/test';

test('browser shell loads the main panels', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: /News Aggregator/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /News Personalization/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Sources/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Flows/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Delivery/i })).toBeVisible();
});
