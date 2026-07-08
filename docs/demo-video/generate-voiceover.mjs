import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetDir = path.join(__dirname, 'assets');
const outputPath = path.join(assetDir, 'voiceover.mp3');

function loadLocalEnvWithoutPrinting() {
  const envPath = path.resolve(process.cwd(), '.env');
  return readFile(envPath, 'utf8')
    .then((content) => {
      for (const line of content.split(/\r?\n/)) {
        let trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
        if (trimmed.startsWith('export ')) {
          trimmed = trimmed.slice('export '.length).trim();
        }
        const index = trimmed.indexOf('=');
        const key = trimmed.slice(0, index).trim();
        let value = trimmed.slice(index + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        } else {
          const commentIndex = value.indexOf(' #');
          if (commentIndex >= 0) {
            value = value.slice(0, commentIndex).trim();
          }
        }
        if (key && process.env[key] === undefined) {
          process.env[key] = value;
        }
      }
    })
    .catch((error) => {
      if (error?.code !== 'ENOENT') throw error;
    });
}

await loadLocalEnvWithoutPrinting();

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  throw new Error('OPENAI_API_KEY is not set. Export it or provide it in .env before running.');
}

const script = await readFile(path.join(__dirname, 'script.md'), 'utf8');
const voiceoverText = script
  .split('\n')
  .filter((line) => line && !line.startsWith('#') && !line.startsWith('Target length:'))
  .join(' ')
  .replace(/\s+/g, ' ')
  .trim();

await mkdir(assetDir, { recursive: true });

const response = await fetch('https://api.openai.com/v1/audio/speech', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'gpt-4o-mini-tts',
    voice: 'marin',
    input: voiceoverText,
    instructions:
      'Speak clearly in professional English for a software project demo. Keep a confident, concise pace.',
  }),
});

if (!response.ok) {
  throw new Error(`OpenAI speech generation failed with status ${response.status}`);
}

await writeFile(outputPath, Buffer.from(await response.arrayBuffer()));
console.log(`Voiceover written to ${path.relative(process.cwd(), outputPath)}`);
