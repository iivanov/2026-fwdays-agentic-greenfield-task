// SSRF Defense Validation Helper

export type DnsResolver = (hostname: string) => Promise<string[]>;

// DnsResolver that runs cleanly in both Deno and Node/Vitest
export const defaultDnsResolver: DnsResolver = async (hostname: string) => {
  if (typeof Deno !== 'undefined' && Deno.resolveDns) {
    const ips: string[] = [];
    try {
      const a = await Deno.resolveDns(hostname, 'A');
      ips.push(...a);
    } catch {
      // Ignore resolution failure for A records
    }
    try {
      const aaaa = await Deno.resolveDns(hostname, 'AAAA');
      ips.push(...aaaa);
    } catch {
      // Ignore resolution failure for AAAA records
    }
    return ips;
  }

  // Fallback to Node.js dns resolver inside Vitest environment
  try {
    const dns = await import('node:dns/promises');
    const lookup = await dns.lookup(hostname, { all: true });
    return lookup.map((r) => r.address);
  } catch {
    return [];
  }
};

// Parses a raw IPv6 address string into exactly 8 numeric blocks of 16-bit values.
// Returns null if the address is malformed or invalid.
export function parseIpv6(ipStr: string): number[] | null {
  const ip = ipStr.trim().toLowerCase();

  // 1. Extract trailing IPv4 part if present (e.g. ::ffff:192.168.1.1)
  let ipv4Part: string | null = null;
  let ipv6Part = ip;

  const lastColon = ip.lastIndexOf(':');
  if (lastColon !== -1) {
    const potentialIpv4 = ip.slice(lastColon + 1);
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(potentialIpv4)) {
      ipv4Part = potentialIpv4;
      ipv6Part = ip.slice(0, lastColon);
    }
  }

  // 2. Split the IPv6 segment
  const parts = ipv6Part.split(':');

  // Fail if there are more than two empty blocks (except if the whole string is just "::")
  if (ip !== '::' && parts.filter((x) => x === '').length > 2) {
    return null;
  }

  let doubleColonIndex = parts.indexOf('');

  // Handle leading/trailing double colons
  if (doubleColonIndex === 0 && parts[1] === '') {
    doubleColonIndex = 0;
    parts.splice(0, 1);
  }

  const blocks: number[] = [];
  for (const part of parts) {
    if (part === '') {
      continue;
    }
    const val = parseInt(part, 16);
    if (isNaN(val) || val < 0 || val > 0xffff) {
      return null;
    }
    blocks.push(val);
  }

  const expectedLength = ipv4Part ? 6 : 8;

  if (doubleColonIndex !== -1) {
    const missingCount = expectedLength - blocks.length;
    if (missingCount < 0) {
      return null;
    }
    const zeros = new Array(missingCount).fill(0);
    blocks.splice(doubleColonIndex, 0, ...zeros);
  }

  if (blocks.length !== expectedLength) {
    return null;
  }

  // 3. Append parsed IPv4 segments if present
  if (ipv4Part) {
    const octets = ipv4Part.split('.').map(Number);
    if (octets.some((o) => isNaN(o) || o < 0 || o > 255)) {
      return null;
    }
    const s6 = (octets[0] << 8) + octets[1];
    const s7 = (octets[2] << 8) + octets[3];
    blocks.push(s6, s7);
  }

  return blocks;
}

// Check if an IP address is a private, loopback, link-local, multicast, or reserved address
export function isPrivateIp(ip: string): boolean {
  const cleanIp = ip.trim().toLowerCase();

  // 1. Check IPv4 format
  const ipv4Match = cleanIp.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [, o1, o2, o3, o4] = ipv4Match.map(Number);
    if (o1 > 255 || o2 > 255 || o3 > 255 || o4 > 255) {
      return true; // invalid IP, fail closed
    }

    // Loopback: 127.0.0.0/8
    if (o1 === 127) return true;

    // Private Class A: 10.0.0.0/8
    if (o1 === 10) return true;

    // Private Class B: 172.16.0.0/12
    if (o1 === 172 && o2 >= 16 && o2 <= 31) return true;

    // Private Class C: 192.168.0.0/16
    if (o1 === 192 && o2 === 168) return true;

    // Link-local: 169.254.0.0/16 (Metadata service)
    if (o1 === 169 && o2 === 254) return true;

    // Broadcast / Local network: 0.0.0.0/8
    if (o1 === 0) return true;

    // Multicast: 224.0.0.0/4
    if (o1 >= 224 && o1 <= 239) return true;

    // Reserved / Class E: 240.0.0.0/4
    if (o1 >= 240) return true;

    // Carrier-grade NAT / Shared: 100.64.0.0/10
    if (o1 === 100 && o2 >= 64 && o2 <= 127) return true;

    // Benchmark: 198.18.0.0/15
    if (o1 === 198 && o2 >= 18 && o2 <= 19) return true;

    // TEST-NET-1: 192.0.2.0/24
    if (o1 === 192 && o2 === 0 && o3 === 2) return true;

    // TEST-NET-2: 198.51.100.0/24
    if (o1 === 198 && o2 === 51 && o3 === 100) return true;

    // TEST-NET-3: 203.0.113.0/24
    if (o1 === 203 && o2 === 0 && o3 === 113) return true;

    return false;
  }

  // 2. Check IPv6 format using parsed segments
  const blocks = parseIpv6(cleanIp);
  if (!blocks) {
    return true; // invalid format, fail closed
  }

  const [s0, s1, s2, s3, s4, s5, s6, s7] = blocks;

  // Unspecified ::
  if (blocks.every((b) => b === 0)) {
    return true;
  }

  // Loopback ::1
  if (
    s0 === 0 &&
    s1 === 0 &&
    s2 === 0 &&
    s3 === 0 &&
    s4 === 0 &&
    s5 === 0 &&
    s6 === 0 &&
    s7 === 1
  ) {
    return true;
  }

  // Unique local addresses (ULA): fc00::/7
  if ((s0 & 0xfe00) === 0xfc00) {
    return true;
  }

  // Link-local: fe80::/10
  if ((s0 & 0xffc0) === 0xfe80) {
    return true;
  }

  // Multicast: ff00::/8
  if ((s0 & 0xff00) === 0xff00) {
    return true;
  }

  // Documentation range: 2001:db8::/32
  if (s0 === 0x2001 && s1 === 0x0db8) {
    return true;
  }

  // IPv4-mapped IPv6 address ranges (e.g. ::ffff:10.0.0.1 or 0:0:0:0:0:ffff:10.0.0.1)
  if (s0 === 0 && s1 === 0 && s2 === 0 && s3 === 0 && s4 === 0 && s5 === 0xffff) {
    const o1 = s6 >> 8;
    const o2 = s6 & 0xff;
    const o3 = s7 >> 8;
    const o4 = s7 & 0xff;
    const mappedIpv4 = `${o1}.${o2}.${o3}.${o4}`;
    return isPrivateIp(mappedIpv4);
  }

  // IPv4-Compatible IPv6 range (::/96, e.g. ::10.0.0.1 or 0:0:0:0:0:0:10.0.0.1)
  if (s0 === 0 && s1 === 0 && s2 === 0 && s3 === 0 && s4 === 0 && s5 === 0) {
    const o1 = s6 >> 8;
    const o2 = s6 & 0xff;
    const o3 = s7 >> 8;
    const o4 = s7 & 0xff;
    const mappedIpv4 = `${o1}.${o2}.${o3}.${o4}`;
    return isPrivateIp(mappedIpv4);
  }

  // IPv4-Translated range (::ffff:0:0:0/96, e.g. ::ffff:0:10.0.0.1)
  if (s0 === 0 && s1 === 0 && s2 === 0 && s3 === 0 && s4 === 0xffff && s5 === 0) {
    const o1 = s6 >> 8;
    const o2 = s6 & 0xff;
    const o3 = s7 >> 8;
    const o4 = s7 & 0xff;
    const mappedIpv4 = `${o1}.${o2}.${o3}.${o4}`;
    return isPrivateIp(mappedIpv4);
  }

  // NAT64 Well-Known Prefix (64:ff9b::/96, e.g. 64:ff9b::10.0.0.1)
  if (s0 === 0x0064 && s1 === 0xff9b && s2 === 0 && s3 === 0 && s4 === 0 && s5 === 0) {
    const o1 = s6 >> 8;
    const o2 = s6 & 0xff;
    const o3 = s7 >> 8;
    const o4 = s7 & 0xff;
    const mappedIpv4 = `${o1}.${o2}.${o3}.${o4}`;
    return isPrivateIp(mappedIpv4);
  }

  // 6to4 Prefix (2002::/16, e.g. 2002:0a00:0001:: for 10.0.0.1)
  if (s0 === 0x2002) {
    const o1 = s1 >> 8;
    const o2 = s1 & 0xff;
    const o3 = s2 >> 8;
    const o4 = s2 & 0xff;
    const mappedIpv4 = `${o1}.${o2}.${o3}.${o4}`;
    return isPrivateIp(mappedIpv4);
  }

  return false;
}

// Full SSRF check returning boolean
export async function validateUrlSsrf(
  urlStr: string,
  resolveDns: DnsResolver = defaultDnsResolver,
): Promise<boolean> {
  try {
    const url = new URL(urlStr);

    // Enforce protocol validation (HTTP/HTTPS only)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return false;
    }

    const hostname = url.hostname.toLowerCase();

    // Check if the hostname is a literal IP address first
    const isIPv4 = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname);
    const isIPv6 = hostname.includes(':') || hostname.startsWith('[');
    const cleanHost = hostname.replace(/\[/g, '').replace(/\]/g, '');

    if (isIPv4 || isIPv6) {
      return !isPrivateIp(cleanHost);
    }

    // Resolve DNS hosts and check all mapping IPs
    const ips = await resolveDns(hostname);
    if (ips.length === 0) {
      return false; // Fail closed if hostname cannot resolve
    }

    for (const ip of ips) {
      if (isPrivateIp(ip)) {
        return false;
      }
    }

    return true;
  } catch {
    return false; // Fail closed on malformed URLs
  }
}
