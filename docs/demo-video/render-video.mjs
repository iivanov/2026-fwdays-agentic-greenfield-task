import { mkdir, readdir, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const deckPath = path.join(__dirname, 'index.html');
const voiceoverPath = path.join(__dirname, 'assets', 'voiceover.mp3');
const outputPath = path.join(__dirname, 'demo-video.mp4');
const tmpDir = path.join('/tmp', 'news-demo-video-render');

const slideDurationsMs = [7_000, 12_000, 16_000, 13_000, 14_000, 10_000, 13_000];

await rm(tmpDir, { recursive: true, force: true });
await mkdir(tmpDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  recordVideo: {
    dir: tmpDir,
    size: { width: 1920, height: 1080 },
  },
});
const page = await context.newPage();

await page.goto(pathToFileURL(deckPath).href);
await page.waitForLoadState('load');

for (let index = 0; index < slideDurationsMs.length; index += 1) {
  await page.waitForTimeout(slideDurationsMs[index]);
  if (index < slideDurationsMs.length - 1) {
    await page.keyboard.press('ArrowRight');
  }
}

const video = page.video();
await context.close();
await browser.close();

const recordedPath = await video.path();
const entries = await readdir(tmpDir);
const webmPath = recordedPath ?? path.join(tmpDir, entries.find((entry) => entry.endsWith('.webm')));

if (!webmPath) {
  throw new Error('Playwright did not produce a WebM recording.');
}

await run('ffmpeg', [
  '-y',
  '-i',
  webmPath,
  '-i',
  voiceoverPath,
  '-map',
  '0:v:0',
  '-map',
  '1:a:0',
  '-c:v',
  'mpeg4',
  '-q:v',
  '4',
  '-tag:v',
  'mp4v',
  '-pix_fmt',
  'yuv420p',
  '-c:a',
  'aac',
  '-shortest',
  outputPath,
]);

console.log(`Demo video written to ${path.relative(process.cwd(), outputPath)}`);

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
  });
}
