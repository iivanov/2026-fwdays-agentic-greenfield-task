import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('../..', import.meta.url).pathname);

const requiredEnvNames = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID',
  'SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET',
  'SUPABASE_AUTH_EXTERNAL_GITHUB_CLIENT_ID',
  'SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET',
  'OPENAI_API_KEY',
  'AI_DAILY_TOKEN_BUDGET',
  'AI_RESPONSE_TOKEN_BUDGET',
  'BREVO_API_KEY',
  'BREVO_SENDER_EMAIL',
  'OPERATOR_ALERT_EMAIL',
  'TELEGRAM_BOT_TOKEN',
  'SCHEDULER_SECRET',
  'ENCRYPTION_MASTER_KEY',
];

const requiredHumanBootstrapItems = [
  'Create Supabase Free project and link only in protected local/CI contexts.',
  'Create Vercel Hobby project for the public personal repository.',
  'Register Google and GitHub OAuth applications.',
  'Enter secrets in Supabase, Vercel, GitHub environments, and provider consoles.',
  'Audit hosted branch protection, secret scanning, push protection, and required checks.',
  'Run protected production deploy and smoke checks after human approval.',
];

const failures = [];
const notes = [];

function readText(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function readJson(path) {
  return JSON.parse(readText(path));
}

function requireCondition(condition, message) {
  if (!condition) failures.push(message);
}

function hasScript(packageJson, name, command) {
  return packageJson.scripts?.[name] === command;
}

const vercel = readJson('vercel.json');
requireCondition(vercel.framework === 'vite', 'vercel.json must declare the Vite framework.');
requireCondition(vercel.installCommand === 'npm ci', 'vercel.json must install with npm ci.');
requireCondition(
  vercel.buildCommand === 'npm run build --workspace @news-aggregator/browser',
  'vercel.json must build the browser workspace.',
);
requireCondition(
  vercel.outputDirectory === 'packages/browser/dist',
  'vercel.json must publish packages/browser/dist.',
);
requireCondition(
  Array.isArray(vercel.rewrites) &&
    vercel.rewrites.some((rewrite) => rewrite.destination === '/index.html'),
  'vercel.json must include an SPA fallback rewrite to /index.html.',
);
requireCondition(!vercel.functions, 'vercel.json must not configure Vercel Functions.');
requireCondition(!vercel.crons, 'vercel.json must not configure Vercel Cron.');
requireCondition(
  !JSON.stringify(vercel.rewrites ?? []).includes('supabase.co'),
  'vercel.json must not proxy Supabase APIs through Vercel rewrites.',
);

const headerKeys = new Set(
  (vercel.headers ?? [])
    .flatMap((entry) => entry.headers ?? [])
    .map((header) => String(header.key).toLowerCase()),
);
for (const key of [
  'content-security-policy',
  'permissions-policy',
  'referrer-policy',
  'strict-transport-security',
  'x-content-type-options',
  'x-frame-options',
  'cache-control',
]) {
  requireCondition(headerKeys.has(key), `vercel.json must configure ${key}.`);
}

const packageJson = readJson('package.json');
requireCondition(
  hasScript(packageJson, 'infra:audit', 'node infra/scripts/audit-deployment.mjs'),
  'package.json must expose npm run infra:audit.',
);
requireCondition(
  hasScript(packageJson, 'infra:bootstrap-check', 'node infra/scripts/bootstrap-check.mjs'),
  'package.json must expose npm run infra:bootstrap-check.',
);
requireCondition(
  packageJson.scripts?.['verify:local']?.includes('npm run infra:audit'),
  'verify:local must include the deployment audit gate.',
);

const envExample = readText('.env.example');
for (const name of requiredEnvNames) {
  requireCondition(
    new RegExp(`^${name}=`, 'm').test(envExample),
    `.env.example must list ${name} without a value.`,
  );
  requireCondition(
    !new RegExp(`^${name}=\\S+`, 'm').test(envExample),
    `.env.example must not contain a value for ${name}.`,
  );
}

const gitignore = readText('.gitignore');
for (const ignoredPath of ['.vercel/', 'supabase/.temp/', 'supabase/.branches/', '.env.*']) {
  requireCondition(gitignore.includes(ignoredPath), `.gitignore must ignore ${ignoredPath}.`);
}

for (const path of [
  'supabase/config.toml',
  'supabase/functions/api/index.ts',
  'supabase/functions/schedule-daily/index.ts',
  'supabase/functions/work/index.ts',
  'supabase/functions/cleanup/index.ts',
  'openspec/changes/archive/2026-07-05-r-19-deploy-config-bootstrap/proposal.md',
  'openspec/changes/archive/2026-07-05-r-19-deploy-config-bootstrap/design.md',
  'openspec/changes/archive/2026-07-05-r-19-deploy-config-bootstrap/verification.md',
  'openspec/changes/archive/2026-07-05-r-19-deploy-config-bootstrap/review.md',
  'openspec/specs/deployment-bootstrap/spec.md',
]) {
  requireCondition(existsSync(resolve(root, path)), `${path} must exist.`);
}

if (existsSync(resolve(root, '.vercel/project.json'))) {
  notes.push(
    '.vercel/project.json exists locally; it is provider link state and must remain untracked.',
  );
}

for (const item of requiredHumanBootstrapItems) {
  notes.push(`human-bootstrap: ${item}`);
}

if (failures.length > 0) {
  console.error('Deployment audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Deployment audit passed.');
console.log(
  `Checked ${requiredEnvNames.length} environment variable names; values were not read or printed.`,
);
for (const note of notes) console.log(`- ${note}`);
