// AES-256-GCM encryption at rest utility using standard Web Crypto API
// Compatible with both Deno (Edge Functions) and Node.js (Vitest)

const CRYPTO_VERSION = 'v1';

// Helper to convert hex string to Uint8Array
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

// Helper to convert Uint8Array to hex string
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Derive a CryptoKey from raw string key
async function getCryptoKey(rawKey: string): Promise<CryptoKey> {
  const rawKeyUint8 = new TextEncoder().encode(rawKey);
  const hash = await crypto.subtle.digest('SHA-256', rawKeyUint8);

  return await crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

export interface EncryptedPayload {
  version: string;
  iv: string;
  ciphertext: string;
  tag: string;
}

export async function encrypt(plaintext: string, secretKey: string): Promise<EncryptedPayload> {
  const key = await getCryptoKey(secretKey);
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 12 bytes IV is standard for GCM

  const data = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);

  // The Web Crypto AES-GCM output is ciphertext appended with the 16-byte authentication tag
  const encryptedBytes = new Uint8Array(encrypted);
  const ciphertextBytes = encryptedBytes.slice(0, -16);
  const tagBytes = encryptedBytes.slice(-16);

  return {
    version: CRYPTO_VERSION,
    iv: bytesToHex(iv),
    ciphertext: bytesToHex(ciphertextBytes),
    tag: bytesToHex(tagBytes),
  };
}

export async function decrypt(encrypted: EncryptedPayload, secretKey: string): Promise<string> {
  if (encrypted.version !== CRYPTO_VERSION) {
    throw new Error(`Unsupported crypto version: ${encrypted.version}`);
  }

  const key = await getCryptoKey(secretKey);
  const iv = hexToBytes(encrypted.iv);
  const ciphertext = hexToBytes(encrypted.ciphertext);
  const tag = hexToBytes(encrypted.tag);

  // Re-assemble GCM format (ciphertext + tag)
  const data = new Uint8Array(ciphertext.length + tag.length);
  data.set(ciphertext);
  data.set(tag, ciphertext.length);

  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);

  return new TextDecoder().decode(decrypted);
}

// Helper to decrypt config if it is encrypted
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function decryptConfig(config: any, secretKey: string): Promise<any> {
  if (config && typeof config === 'object' && 'ciphertext' in config && 'tag' in config) {
    try {
      const decryptedStr = await decrypt(config, secretKey);
      return JSON.parse(decryptedStr);
    } catch {
      return {};
    }
  }
  return config; // Fallback to plaintext if not encrypted yet
}

// Helper to encrypt config
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function encryptConfig(config: any, secretKey: string): Promise<EncryptedPayload> {
  const plaintext = JSON.stringify(config);
  return await encrypt(plaintext, secretKey);
}

// Helper to mask secret value strings in frontend context
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function maskSecretValue(type: string, key: string, value: any): any {
  if (typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value !== 'string') return '*****';
  if (!value) return '';

  if (type === 'slack') {
    const idx = value.indexOf('/services/');
    if (idx !== -1) {
      return value.substring(0, idx + 10) + '*****';
    }
    return '*****';
  }

  if (type === 'webhook') {
    if (key === 'signing_secret') {
      return '*****';
    }
    try {
      const url = new URL(value);
      if (url.password) url.password = '*****';
      if (url.search) url.search = '?*****';
      return url.toString();
    } catch {
      return '*****';
    }
  }

  if (type === 'telegram') {
    if (key === 'bot_token') {
      return '*****';
    }
    if (key === 'chat_id') {
      return value.substring(0, Math.min(3, value.length)) + '*****';
    }
  }

  if (type === 'email') {
    const parts = value.split('@');
    if (parts.length === 2) {
      const local = parts[0];
      return local.charAt(0) + '***' + local.slice(-1) + '@' + parts[1];
    }
  }

  return '*****';
}

// Helper to mask a complete config object based on channel type
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function maskConfig(type: string, config: any): any {
  if (!config || typeof config !== 'object') return {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const masked: any = {};
  for (const [k, v] of Object.entries(config)) {
    masked[k] = maskSecretValue(type, k, v);
  }
  return masked;
}

export function getMasterKey(): string {
  let key = '';
  try {
    const globalRecord = globalThis as Record<string, unknown>;
    const anyDeno = globalRecord.Deno as Record<string, unknown> | undefined;
    if (anyDeno && typeof anyDeno.env === 'object' && anyDeno.env !== null) {
      const envRecord = anyDeno.env as Record<string, unknown>;
      if (typeof envRecord.get === 'function') {
        key = (envRecord.get('MASTER_CRYPTO_KEY') as string) || '';
      }
    }
  } catch {
    // ignore
  }

  if (!key) {
    try {
      const globalRecord = globalThis as Record<string, unknown>;
      const anyProcess = globalRecord.process as Record<string, unknown> | undefined;
      if (anyProcess && typeof anyProcess.env === 'object' && anyProcess.env !== null) {
        const envRecord = anyProcess.env as Record<string, string>;
        key = envRecord.MASTER_CRYPTO_KEY || '';
      }
    } catch {
      // ignore
    }
  }

  if (!key) {
    const globalRecord = globalThis as Record<string, unknown>;
    const isTest =
      typeof globalRecord.vitest !== 'undefined' ||
      (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test');
    if (isTest) {
      return 'default-fallback-master-key-for-local-testing-only-vitest-mock';
    }
    throw new Error(
      'MASTER_CRYPTO_KEY environment variable is not configured. Encryption is disabled.',
    );
  }

  return key;
}
