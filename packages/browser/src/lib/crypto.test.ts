import { describe, it, expect } from 'vitest';
import { Buffer } from 'node:buffer';
import {
  encrypt,
  decrypt,
  encryptConfig,
  decryptConfig,
  encryptPromptTemplate,
  decryptPromptTemplate,
  maskConfig,
} from '../../../../supabase/functions/api/crypto.js';

describe('AES-256-GCM Encryption Module', () => {
  const secretKey = 'test-secret-key-that-is-long-enough';
  const alternativeKey = 'another-secret-key-different-hash';
  const samplePlaintext = 'Hello, world! This is a secret message.';

  it('should encrypt and decrypt plaintext symmetrically using Web Crypto API', async () => {
    const encrypted = await encrypt(samplePlaintext, secretKey);
    expect(encrypted.version).toBe('v1');
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.tag).toBeDefined();

    const decrypted = await decrypt(encrypted, secretKey);
    expect(decrypted).toBe(samplePlaintext);
  });

  it('should fail decryption if wrong secret key is provided', async () => {
    const encrypted = await encrypt(samplePlaintext, secretKey);
    await expect(decrypt(encrypted, alternativeKey)).rejects.toThrow();
  });

  it('should fail decryption if ciphertext or tag is tampered with', async () => {
    const encrypted = await encrypt(samplePlaintext, secretKey);
    const tamperedCiphertext = Buffer.from(encrypted.ciphertext, 'base64');
    tamperedCiphertext[0] ^= 0xff;
    const tampered = { ...encrypted, ciphertext: tamperedCiphertext.toString('base64') };
    await expect(decrypt(tampered, secretKey)).rejects.toThrow();
  });

  it('should encrypt and decrypt config objects symmetrically', async () => {
    const originalConfig = {
      webhook_url: 'https://hooks.slack.com/services/123/abc',
      is_active: true,
    };
    const encryptedConfig = await encryptConfig(originalConfig, secretKey);

    const decryptedConfig = await decryptConfig(encryptedConfig, secretKey);
    expect(decryptedConfig).toEqual(originalConfig);
  });

  it('should transparently return config object if it is not encrypted', async () => {
    const plaintextConfig = { email: 'user@example.com' };
    const result = await decryptConfig(plaintextConfig, secretKey);
    expect(result).toEqual(plaintextConfig);
  });

  it('should encrypt prompt templates and refuse legacy plaintext prompt values', async () => {
    const encryptedPrompt = await encryptPromptTemplate('Prioritize security news', secretKey);
    expect(encryptedPrompt).not.toContain('Prioritize security news');
    expect(await decryptPromptTemplate(encryptedPrompt, secretKey)).toBe(
      'Prioritize security news',
    );
    await expect(
      decrypt(encryptedPrompt ? JSON.parse(encryptedPrompt) : {}, alternativeKey),
    ).rejects.toThrow();
    expect(await decryptPromptTemplate('Prioritize security news', secretKey)).toBeNull();
  });

  describe('Config Masking Utilities', () => {
    it('should mask Slack webhook URL configurations properly', () => {
      const config = { url: 'https://hooks.slack.com/services/T123/B456/SECRET' };
      const masked = maskConfig('slack', config);
      expect(masked.url).toBe('https://hooks.slack.com/services/*****');
    });

    it('should mask generic webhooks including credentials and signing secrets', () => {
      const config = {
        url: 'https://user:password@target.com/path?foo=bar',
        signing_secret: 'secret-key-123',
      };
      const masked = maskConfig('webhook', config);
      expect(masked.url).toBe('https://user:*****@target.com/path?*****');
      expect(masked.signing_secret).toBe('*****');
    });

    it('should mask Telegram tokens and keep partial chat IDs', () => {
      const config = { bot_token: '123456:ABC-DEF', chat_id: '987654321' };
      const masked = maskConfig('telegram', config);
      expect(masked.bot_token).toBe('*****');
      expect(masked.chat_id).toBe('987*****');
    });

    it('should mask email addresses retaining domain details', () => {
      const config = { email: 'john.doe@gmail.com' };
      const masked = maskConfig('email', config);
      expect(masked.email).toBe('j***e@gmail.com');
    });
  });
});
