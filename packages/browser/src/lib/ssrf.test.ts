import { describe, it, expect } from 'vitest';
import {
  fetchWithSsrfProtection,
  isPrivateIp,
  SsrfProtectionError,
  validateUrlSsrf,
} from '../../../../supabase/functions/api/ssrf.ts';

describe('SSRF Protection Tests', () => {
  describe('isPrivateIp Validation Matrix', () => {
    it('should classify loopback addresses as private', () => {
      expect(isPrivateIp('127.0.0.1')).toBe(true);
      expect(isPrivateIp('127.255.0.1')).toBe(true);
      expect(isPrivateIp('::1')).toBe(true);
      expect(isPrivateIp('0:0:0:0:0:0:0:1')).toBe(true);
    });

    it('should classify RFC 1918 private IPv4 ranges as private', () => {
      expect(isPrivateIp('10.0.0.1')).toBe(true);
      expect(isPrivateIp('10.254.10.2')).toBe(true);
      expect(isPrivateIp('172.16.5.9')).toBe(true);
      expect(isPrivateIp('172.31.255.254')).toBe(true);
      expect(isPrivateIp('192.168.1.1')).toBe(true);
      expect(isPrivateIp('192.168.254.254')).toBe(true);
    });

    it('should classify link-local and cloud metadata addresses as private', () => {
      expect(isPrivateIp('169.254.169.254')).toBe(true); // AWS/GCP Metadata
      expect(isPrivateIp('fe80::1')).toBe(true); // IPv6 Link-Local
    });

    it('should classify unique local IPv6 addresses as private', () => {
      expect(isPrivateIp('fc00::1')).toBe(true);
      expect(isPrivateIp('fdff:ffff::1')).toBe(true);
    });

    it('should classify carrier-grade NAT, shared, and reserved classes as private', () => {
      expect(isPrivateIp('0.0.0.0')).toBe(true);
      expect(isPrivateIp('100.64.0.1')).toBe(true);
      expect(isPrivateIp('224.0.0.1')).toBe(true); // Multicast
      expect(isPrivateIp('245.0.0.1')).toBe(true); // Class E
    });

    it('should classify public internet IP addresses as public', () => {
      expect(isPrivateIp('8.8.8.8')).toBe(false);
      expect(isPrivateIp('1.1.1.1')).toBe(false);
      expect(isPrivateIp('142.250.190.46')).toBe(false);
      expect(isPrivateIp('2606:4700:4700::1111')).toBe(false); // Cloudflare DNS IPv6
    });

    it('should handle IPv4-mapped IPv6 address blocks', () => {
      expect(isPrivateIp('::ffff:127.0.0.1')).toBe(true);
      expect(isPrivateIp('::ffff:8.8.8.8')).toBe(false);
    });

    it('should catch compressed and non-normalized IPv6 bypass attempts', () => {
      expect(isPrivateIp('::0001')).toBe(true); // Loopback
      expect(isPrivateIp('0000::1')).toBe(true); // Loopback
      expect(isPrivateIp('0000:0000:0000:0000:0000:0000:0000:0001')).toBe(true);
    });

    it('should catch alternate mapped formats and hex-encoded IPv4-mapped IPv6 addresses', () => {
      expect(isPrivateIp('0:0:0:0:0:ffff:10.0.0.1')).toBe(true); // Alternate mapping
      expect(isPrivateIp('::ffff:0a00:0001')).toBe(true); // Hex mapping for 10.0.0.1
      expect(isPrivateIp('::ffff:7f00:0001')).toBe(true); // Hex mapping for 127.0.0.1
      expect(isPrivateIp('::ffff:0808:0808')).toBe(false); // Hex mapping for 8.8.8.8 (public)
    });

    it('should catch NAT64, 6to4, IPv4-Compatible, and IPv4-Translated mapping bypasses', () => {
      // IPv4-Compatible IPv6 range ::/96
      expect(isPrivateIp('::10.0.0.1')).toBe(true);
      expect(isPrivateIp('0:0:0:0:0:0:10.0.0.1')).toBe(true);
      expect(isPrivateIp('::0a00:0001')).toBe(true); // hex 10.0.0.1
      expect(isPrivateIp('::0808:0808')).toBe(false); // hex 8.8.8.8 (public)

      // IPv4-Translated range ::ffff:0:0:0/96
      expect(isPrivateIp('::ffff:0:10.0.0.1')).toBe(true);
      expect(isPrivateIp('0:0:0:0:ffff:0:10.0.0.1')).toBe(true);

      // NAT64 Well-Known Prefix 64:ff9b::/96
      expect(isPrivateIp('64:ff9b::10.0.0.1')).toBe(true);
      expect(isPrivateIp('64:ff9b::0a00:0001')).toBe(true);
      expect(isPrivateIp('64:ff9b::0808:0808')).toBe(false); // public

      // 6to4 Prefix 2002::/16
      expect(isPrivateIp('2002:0a00:0001::')).toBe(true); // 10.0.0.1
      expect(isPrivateIp('2002:7f00:0001::')).toBe(true); // 127.0.0.1
      expect(isPrivateIp('2002:0808:0808::')).toBe(false); // 8.8.8.8 (public)

      // Unspecified address
      expect(isPrivateIp('::')).toBe(true);
      expect(isPrivateIp('0:0:0:0:0:0:0:0')).toBe(true);
    });
  });

  describe('validateUrlSsrf Router Wrappers', () => {
    it('should reject non http/https protocols', async () => {
      expect(await validateUrlSsrf('ftp://example.com/feed.xml')).toBe(false);
      expect(await validateUrlSsrf('gopher://10.0.0.1')).toBe(false);
      expect(await validateUrlSsrf('file:///etc/passwd')).toBe(false);
    });

    it('should reject literal private IP addresses in URLs', async () => {
      expect(await validateUrlSsrf('http://127.0.0.1/feed')).toBe(false);
      expect(await validateUrlSsrf('https://[::1]/feed')).toBe(false);
      expect(await validateUrlSsrf('http://10.0.0.5:8080/feed')).toBe(false);
      expect(await validateUrlSsrf('http://169.254.169.254/latest/meta-data/')).toBe(false);
    });

    it('should reject literal non-normalized IP bypass attempts in URLs', async () => {
      expect(await validateUrlSsrf('http://[::0001]/feed')).toBe(false);
      expect(await validateUrlSsrf('http://[0000::1]/feed')).toBe(false);
      expect(await validateUrlSsrf('http://[0:0:0:0:0:ffff:10.0.0.1]/feed')).toBe(false);
      expect(await validateUrlSsrf('http://[::ffff:0a00:0001]/feed')).toBe(false);
      expect(await validateUrlSsrf('http://[::10.0.0.1]/feed')).toBe(false);
      expect(await validateUrlSsrf('http://[::ffff:0:10.0.0.1]/feed')).toBe(false);
      expect(await validateUrlSsrf('http://[64:ff9b::10.0.0.1]/feed')).toBe(false);
      expect(await validateUrlSsrf('http://[2002:0a00:0001::]/feed')).toBe(false);
      expect(await validateUrlSsrf('http://[::]/feed')).toBe(false);
    });

    it('should reject hostname resolving to private IPs', async () => {
      const mockResolver = async () => ['10.0.0.1'];
      expect(await validateUrlSsrf('https://internal.local/feed', mockResolver)).toBe(false);
    });

    it('should allow hostnames resolving to public IPs', async () => {
      const mockResolver = async () => ['8.8.8.8', '1.1.1.1'];
      expect(await validateUrlSsrf('https://google.com/feed', mockResolver)).toBe(true);
    });

    it('should reject hostnames that fail to resolve (fail-closed)', async () => {
      const mockResolver = async () => [];
      expect(await validateUrlSsrf('https://unresolvable-domain.xyz/feed', mockResolver)).toBe(
        false,
      );
    });

    it('should reject hostnames that resolve to mixed public and private IPs (fail-closed)', async () => {
      const mockResolver = async () => ['8.8.8.8', '127.0.0.1'];
      expect(await validateUrlSsrf('https://mixed-ip-resolution.com/feed', mockResolver)).toBe(
        false,
      );
    });
  });

  describe('fetchWithSsrfProtection', () => {
    it('rejects DNS rebinding changes before fetch is invoked', async () => {
      const calls: string[] = [];
      const resolveDns = async () => ['127.0.0.1'];
      const fetchImpl = async (input: string | URL | Request) => {
        calls.push(String(input));
        return new Response('should not fetch');
      };

      await expect(
        fetchWithSsrfProtection('https://example.com/feed', {}, { resolveDns, fetchImpl }),
      ).rejects.toBeInstanceOf(SsrfProtectionError);
      expect(calls).toEqual([]);
    });

    it('rejects redirects to unsafe addresses before fetching the redirect target', async () => {
      const fetched: string[] = [];
      const resolveDns = async (hostname: string) =>
        hostname === 'safe.example' ? ['8.8.8.8'] : ['169.254.169.254'];
      const fetchImpl = async (input: string | URL | Request) => {
        fetched.push(String(input));
        return new Response(null, {
          status: 302,
          headers: { location: 'http://metadata.example/latest/meta-data' },
        });
      };

      await expect(
        fetchWithSsrfProtection(
          'https://safe.example/feed',
          {},
          {
            resolveDns,
            fetchImpl,
            followRedirects: true,
          },
        ),
      ).rejects.toBeInstanceOf(SsrfProtectionError);
      expect(fetched).toEqual(['https://safe.example/feed']);
    });

    it('follows safe relative redirects when redirects are explicitly enabled', async () => {
      const fetched: string[] = [];
      const resolveDns = async () => ['8.8.8.8'];
      const fetchImpl = async (input: string | URL | Request) => {
        fetched.push(String(input));
        if (fetched.length === 1) {
          return new Response(null, { status: 302, headers: { location: '/next.xml' } });
        }
        return new Response('ok', { status: 200 });
      };

      const response = await fetchWithSsrfProtection(
        'https://safe.example/feed',
        {},
        {
          resolveDns,
          fetchImpl,
          followRedirects: true,
        },
      );
      expect(response.status).toBe(200);
      expect(await response.text()).toBe('ok');
      expect(fetched).toEqual(['https://safe.example/feed', 'https://safe.example/next.xml']);
    });

    it('does not follow redirects when redirects are disabled', async () => {
      const fetched: string[] = [];
      const resolveDns = async () => ['8.8.8.8'];
      const fetchImpl = async (input: string | URL | Request) => {
        fetched.push(String(input));
        return new Response(null, { status: 302, headers: { location: '/next.xml' } });
      };

      const response = await fetchWithSsrfProtection(
        'https://safe.example/hook',
        {},
        {
          resolveDns,
          fetchImpl,
        },
      );
      expect(response.status).toBe(302);
      expect(fetched).toEqual(['https://safe.example/hook']);
    });
  });
});
