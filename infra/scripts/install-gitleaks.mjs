#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { chmod, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { get } from 'node:https';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const version = '8.30.1';
const checksums = {
  'darwin-arm64': 'b40ab0ae55c505963e365f271a8d3846efbc170aa17f2607f13df610a9aeb6a5',
  'darwin-x64': 'dfe101a4db2255fc85120ac7f3d25e4342c3c20cf749f2c20a18081af1952709',
  'linux-arm64': 'e4a487ee7ccd7d3a7f7ec08657610aa3606637dab924210b3aee62570fb4b080',
  'linux-x64': '551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb',
};

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const binDir = path.join(repoRoot, '.tools', 'bin');
const binaryPath = path.join(binDir, process.platform === 'win32' ? 'gitleaks.exe' : 'gitleaks');

function platformKey() {
  if (!['darwin', 'linux'].includes(process.platform)) {
    throw new Error(`Unsupported platform for pinned Gitleaks installer: ${process.platform}`);
  }
  if (!['arm64', 'x64'].includes(process.arch)) {
    throw new Error(`Unsupported architecture for pinned Gitleaks installer: ${process.arch}`);
  }
  return `${process.platform}-${process.arch}`;
}

function download(url, destination) {
  return new Promise((resolve, reject) => {
    get(url, (response) => {
      if (
        response.statusCode &&
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        download(response.headers.location, destination).then(resolve, reject);
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`Download failed with HTTP ${response.statusCode}: ${url}`));
        response.resume();
        return;
      }
      const file = createWriteStream(destination);
      response.pipe(file);
      file.on('finish', () => file.close(resolve));
      file.on('error', reject);
    }).on('error', reject);
  });
}

async function sha256(filePath) {
  const data = await readFile(filePath);
  return createHash('sha256').update(data).digest('hex');
}

async function installedVersion() {
  try {
    const { stdout } = await execFileAsync(binaryPath, ['version']);
    return stdout.trim();
  } catch {
    return '';
  }
}

async function main() {
  const currentVersion = await installedVersion();
  if (currentVersion.includes(version)) {
    console.log(`Gitleaks ${version} already installed at ${path.relative(repoRoot, binaryPath)}`);
    return;
  }

  const key = platformKey();
  const checksum = checksums[key];
  const archiveName = `gitleaks_${version}_${key.replace('-', '_')}.tar.gz`;
  const url = `https://github.com/gitleaks/gitleaks/releases/download/v${version}/${archiveName}`;
  const tempDir = await mkdtemp(path.join(tmpdir(), 'gitleaks-'));
  const archivePath = path.join(tempDir, archiveName);

  try {
    await mkdir(binDir, { recursive: true });
    await download(url, archivePath);

    const actualChecksum = await sha256(archivePath);
    if (actualChecksum !== checksum) {
      throw new Error(`Checksum mismatch for ${archiveName}`);
    }

    await execFileAsync('tar', ['-xzf', archivePath, '-C', binDir, 'gitleaks']);
    await chmod(binaryPath, 0o755);
    console.log(`Installed Gitleaks ${version} at ${path.relative(repoRoot, binaryPath)}`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
