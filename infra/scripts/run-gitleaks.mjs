#!/usr/bin/env node
import { access } from 'node:fs/promises';
import { cp, lstat, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const binaryPath = path.join(
  repoRoot,
  '.tools',
  'bin',
  process.platform === 'win32' ? 'gitleaks.exe' : 'gitleaks',
);

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: repoRoot, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} exited with ${code}`));
    });
  });
}

function capture(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: repoRoot, stdio: ['ignore', 'pipe', 'inherit'] });
    const chunks = [];
    child.stdout.on('data', (chunk) => chunks.push(chunk));
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve(Buffer.concat(chunks));
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} exited with ${code}`));
    });
  });
}

async function ensureInstalled() {
  try {
    await access(binaryPath);
  } catch {
    await run(process.execPath, ['infra/scripts/install-gitleaks.mjs']);
  }
}

async function main() {
  await ensureInstalled();
  const tempDir = await mkdtemp(path.join(tmpdir(), 'tracked-secrets-scan-'));
  try {
    const filesOutput = await capture('git', ['ls-files', '-z']);
    const files = filesOutput.toString('utf8').split('\0').filter(Boolean);

    for (const file of files) {
      if (file === '.env' || file.startsWith('.env.')) {
        continue;
      }
      const source = path.join(repoRoot, file);
      const destination = path.join(tempDir, file);
      try {
        const stat = await lstat(source);
        if (stat.isSymbolicLink()) {
          continue;
        }
      } catch {
        continue;
      }
      await mkdir(path.dirname(destination), { recursive: true });
      await cp(source, destination);
    }

    await run(binaryPath, [
      'dir',
      tempDir,
      '--redact',
      '--verbose',
      '--no-banner',
      '--config',
      path.join(repoRoot, '.gitleaks.toml'),
    ]);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
