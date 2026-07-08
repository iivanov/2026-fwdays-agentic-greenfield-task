import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetDir = path.join(__dirname, 'assets');
const baseUrl = process.env.DEMO_BASE_URL ?? 'http://127.0.0.1:4173';

const viewport = { width: 1440, height: 960 };

await mkdir(assetDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });

await page.route('**/functions/v1/api/channels', async (route) => {
  await route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      data: [
        {
          id: 'channel-email',
          type: 'email',
          status: 'active',
          config: {},
          verified_at: '2026-07-05T06:00:00.000Z',
          created_at: '2026-07-03T09:00:00.000Z',
        },
        {
          id: 'channel-webhook',
          type: 'webhook',
          status: 'pending',
          config: { webhook_url: 'https://example.com/news-digest' },
          verified_at: null,
          created_at: '2026-07-04T11:30:00.000Z',
        },
      ],
    }),
  });
});

await page.route('**/functions/v1/api/flows', async (route) => {
  await route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      data: [
        { id: 'flow-market', name: 'Markets and policy brief' },
        { id: 'flow-ai', name: 'AI research watch' },
      ],
    }),
  });
});

async function capture(name, url, action) {
  await page.goto(`${baseUrl}${url}`, { waitUntil: 'networkidle' });
  if (action) {
    await action();
  }
  await page.screenshot({ path: path.join(assetDir, `${name}.png`), fullPage: false });
}

await capture('landing', '/');
await capture('dashboard-overview', '/dashboard?fixture=dashboard');
await capture('digest-feedback', '/dashboard/digests?fixture=dashboard', async () => {
  await page.getByRole('button', { name: 'Expand', exact: true }).first().click();
  await page.waitForTimeout(250);
});
await capture('delivery-channels', '/dashboard/delivery?fixture=dashboard', async () => {
  await page.getByRole('combobox').selectOption('telegram');
  await page.waitForTimeout(250);
});

await page.setContent(`
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <style>
        body {
          margin: 0;
          width: 1440px;
          height: 960px;
          background: #f6f7f1;
          color: #151716;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .board {
          box-sizing: border-box;
          width: 100%;
          height: 100%;
          padding: 72px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 28px;
        }
        .hero {
          grid-row: span 2;
          border: 1px solid #151716;
          background: #111827;
          color: #f8fafc;
          padding: 44px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .hero h1 {
          font-family: Georgia, "Times New Roman", serif;
          font-size: 70px;
          line-height: 0.95;
          margin: 0;
          letter-spacing: 0;
        }
        .hero p, .card p {
          margin: 0;
          color: #cbd5e1;
          font-size: 24px;
          line-height: 1.35;
        }
        .card {
          border: 1px solid #151716;
          background: #ffffff;
          padding: 32px;
          display: grid;
          gap: 18px;
          align-content: start;
        }
        .card h2 {
          margin: 0;
          font-size: 30px;
        }
        .card p {
          color: #3f4642;
          font-size: 21px;
        }
        .tag {
          width: fit-content;
          border: 1px solid #151716;
          padding: 7px 10px;
          font-size: 14px;
          letter-spacing: .08em;
          text-transform: uppercase;
          color: #151716;
        }
        .hero .tag {
          border-color: #93c5fd;
          color: #bfdbfe;
        }
      </style>
    </head>
    <body>
      <main class="board">
        <section class="hero">
          <span class="tag">Process evidence</span>
          <h1>Agentic engineering, not vibe coding.</h1>
          <p>Every material change keeps traceability, verification, and review evidence.</p>
        </section>
        <section class="card">
          <span class="tag">Rules</span>
          <h2>AGENTS.md</h2>
          <p>Repository guidance defines spec-driven work, state tracking, verification gates, secrets policy, and maker != checker.</p>
        </section>
        <section class="card">
          <span class="tag">OpenSpec</span>
          <h2>Verifier + reviewer reports</h2>
          <p>Archived changes retain final verification and independent review reports before the slice is treated as done.</p>
        </section>
      </main>
    </body>
  </html>
`);
await page.screenshot({ path: path.join(assetDir, 'process-evidence.png'), fullPage: false });

await browser.close();

console.log(`Demo screenshots written to ${path.relative(process.cwd(), assetDir)}`);
