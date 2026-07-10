#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const prerequisiteMessage =
  'Supabase integration prerequisites failed. Run "npm run supabase:start" and "npm run supabase:reset" before "npm run test:integration".';

function runCapture(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout = [];
    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve(Buffer.concat(stdout).toString('utf8'));
        return;
      }
      reject(new Error(`${command} exited with ${code}`));
    });
  });
}

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: repoRoot, env, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => resolve(code ?? 1));
  });
}

function unquote(value) {
  if (!value.startsWith('"') || !value.endsWith('"')) {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value.slice(1, -1);
  }
}

export function parseLocalSupabaseStatus(statusOutput) {
  const values = new Map();

  for (const line of statusOutput.split(/\r?\n/)) {
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (match) {
      values.set(match[1], unquote(match[2]));
    }
  }

  const apiUrl = values.get('API_URL');
  const serviceRoleKey = values.get('SERVICE_ROLE_KEY');
  if (!apiUrl || !serviceRoleKey) {
    throw new Error('Supabase status did not provide the required local integration credentials.');
  }

  return { apiUrl, serviceRoleKey };
}

async function main() {
  try {
    const statusOutput = await runCapture('npx', [
      '--no-install',
      'supabase',
      'status',
      '-o',
      'env',
    ]);
    const { apiUrl, serviceRoleKey } = parseLocalSupabaseStatus(statusOutput);
    const exitCode = await run(
      'npx',
      ['--no-install', 'vitest', 'run', '--config', 'vitest.integration.config.ts'],
      {
        ...process.env,
        SUPABASE_URL: apiUrl,
        SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
      },
    );
    process.exitCode = exitCode;
  } catch {
    console.error(prerequisiteMessage);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
