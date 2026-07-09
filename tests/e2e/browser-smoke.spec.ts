import { expect, test } from '@playwright/test';

test('browser shell loads the main panels', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: /Source-backed daily briefings/i })).toBeVisible();
  await expect(page.getByText(/Connect trusted feeds and article URLs/i)).toBeVisible();
  await expect(page.getByAltText(/source cards flowing into one daily digest/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /Sign in with Google/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Sign in with GitHub/i })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: /Watch the 81-second build walkthrough/i }),
  ).toBeVisible();
  await expect(page.getByRole('group', { name: /Project demo video frame/i })).toBeVisible();
  await expect(page.getByText(/or dev login/i)).toHaveCount(0);
});

test('public landing page stays usable on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/');

  await expect(page.getByRole('heading', { name: /Source-backed daily briefings/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Sign in with Google/i })).toBeVisible();
  await expect(page.getByText(/Source intake/i)).toBeVisible();
  await expect(page.getByText(/Delivery secrets stay encrypted/i)).toBeVisible();
  await expect(
    page.getByRole('heading', { name: /Watch the 81-second build walkthrough/i }),
  ).toBeVisible();
  await expect(page.getByRole('group', { name: /Project demo video frame/i })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});

test('demo video asset is served', async ({ request }) => {
  const response = await request.get('/demo-video.webm');

  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toContain('video/webm');
});

test('demo video decodes visible frames in the browser', async ({ page }) => {
  await page.goto('/');

  const frame = await page
    .locator('video[aria-label="Project demo video"]')
    .evaluate(async (video: HTMLVideoElement) => {
      video.preload = 'auto';
      video.muted = true;

      if (video.readyState < HTMLMediaElement.HAVE_METADATA) {
        await new Promise<void>((resolve) => {
          video.addEventListener('loadedmetadata', () => resolve(), { once: true });
        });
      }

      video.currentTime = Math.min(8, Math.max(0, video.duration - 1));
      await new Promise<void>((resolve) => {
        video.addEventListener('seeked', () => resolve(), { once: true });
      });

      await new Promise<void>((resolve) => window.setTimeout(resolve, 250));

      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 90;
      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error('Canvas context is unavailable.');
      }

      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
      let visiblePixels = 0;

      for (let index = 0; index < data.length; index += 4) {
        const brightness = data[index] + data[index + 1] + data[index + 2];
        if (brightness > 72) {
          visiblePixels += 1;
        }
      }

      return {
        currentTime: video.currentTime,
        height: video.videoHeight,
        visibleRatio: visiblePixels / (canvas.width * canvas.height),
        width: video.videoWidth,
      };
    });

  expect(frame.width).toBe(1920);
  expect(frame.height).toBe(1080);
  expect(frame.currentTime).toBeGreaterThan(0);
  expect(frame.visibleRatio).toBeGreaterThan(0.2);
});

test('unauthenticated protected dashboard routes show sign-in shell', async ({ page }) => {
  await page.goto('/dashboard/digests');

  await expect(page.getByRole('heading', { name: /Source-backed daily briefings/i })).toBeVisible();
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
  await expect(page.getByRole('heading', { name: /Source-backed daily briefings/i })).toBeVisible();
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
  await expect(page.getByRole('heading', { name: /Source-backed daily briefings/i })).toBeVisible();
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
  await expect(page.getByText(/Policy teams signaled a slower path for cuts/i)).toBeHidden();
  await page.getByRole('button', { name: 'Expand', exact: true }).click();
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

test('telegram delivery setup shows bot identity and chat id guidance', async ({ page }) => {
  await page.route('**/functions/v1/api/channels', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    });
  });
  await page.route('**/functions/v1/api/flows', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    });
  });

  await page.goto('/dashboard/delivery?fixture=dashboard');

  await expect(page.getByRole('heading', { name: /Delivery Channels/i })).toBeVisible();
  await page.getByRole('combobox').selectOption('telegram');

  await expect(page.getByRole('link', { name: '@news_desk_ai_bot' })).toHaveAttribute(
    'href',
    'https://t.me/news_desk_ai_bot',
  );
  await expect(page.getByText(/The bot replies with the numeric chat ID/i)).toBeVisible();
  await expect(page.getByText(/Do not paste the bot token into this dashboard/i)).toBeVisible();
});
