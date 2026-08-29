/**
 * Centralized Server-Side Request Forgery (SSRF) Protection and URL Validation.
 *
 * Validates external URLs against:
 * - Non-HTTP/HTTPS protocols (file:, gopher:, javascript:, data:, etc.)
 * - Non-standard numeric IP encodings (decimal dword, octal, hex, mixed)
 * - Loopback addresses (127.0.0.0/8, ::1)
 * - RFC 1918 Private IPv4 networks (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
 * - Link-local & Cloud metadata endpoints (169.254.0.0/16, metadata.google.internal, 100.100.100.200)
 * - IPv6 private, link-local (fe80::/10), unique-local (fc00::/7), and IPv4-mapped IPv6 (::ffff:x.x.x.x)
 * - DNS rebinding wildcards (*.nip.io, *.sslip.io, *.traefik.me, *.localtest.me, etc.)
 */

export interface UrlValidationResult {
  valid: boolean;
  error?: string;
}

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.goog",
  "instance-data",
  "instance-data.ec2.internal",
  "kubernetes.default.svc",
  "kubernetes.default",
]);

const BLOCKED_DOMAIN_SUFFIXES = [
  ".nip.io",
  "nip.io",
  ".sslip.io",
  "sslip.io",
  ".traefik.me",
  "traefik.me",
  ".localtest.me",
  "localtest.me",
  ".lvh.me",
  "lvh.me",
  ".vcap.me",
  "vcap.me",
  ".local",
  ".internal",
  ".localhost",
  ".onion",
];

/**
 * Checks if a 4-octet IPv4 address falls within private, loopback, or cloud metadata ranges.
 */
function isPrivateIpv4(a: number, b: number, c: number, d: number): { isPrivate: boolean; reason?: string } {
  // 0.0.0.0/8 ("This" network)
  if (a === 0) return { isPrivate: true, reason: "0.0.0.0/8 (This network / Current network)" };
  // 10.0.0.0/8 (RFC1918 Private)
  if (a === 10) return { isPrivate: true, reason: "10.0.0.0/8 (RFC1918 Private)" };
  // 100.64.0.0/10 (Carrier-Grade NAT)
  if (a === 100 && b >= 64 && b <= 127) return { isPrivate: true, reason: "100.64.0.0/10 (Carrier-Grade NAT)" };
  // 127.0.0.0/8 (Loopback)
  if (a === 127) return { isPrivate: true, reason: "127.0.0.0/8 (Loopback)" };
  // 169.254.0.0/16 (Link-Local & Cloud Metadata)
  if (a === 169 && b === 254) return { isPrivate: true, reason: "169.254.0.0/16 (Link-Local / Cloud Metadata)" };
  // 172.16.0.0/12 (RFC1918 Private: 172.16.0.0 - 172.31.255.255)
  if (a === 172 && b >= 16 && b <= 31) return { isPrivate: true, reason: "172.16.0.0/12 (RFC1918 Private)" };
  // 192.0.0.0/24 (IETF Protocol Assignments)
  if (a === 192 && b === 0 && c === 0) return { isPrivate: true, reason: "192.0.0.0/24 (IETF Reserved)" };
  // 192.0.2.0/24 (TEST-NET-1)
  if (a === 192 && b === 0 && c === 2) return { isPrivate: true, reason: "192.0.2.0/24 (Documentation/Test)" };
  // 192.168.0.0/16 (RFC1918 Private)
  if (a === 192 && b === 168) return { isPrivate: true, reason: "192.168.0.0/16 (RFC1918 Private)" };
  // 198.18.0.0/15 (Network Benchmark Tests: 198.18.0.0 - 198.19.255.255)
  if (a === 198 && (b === 18 || b === 19)) return { isPrivate: true, reason: "198.18.0.0/15 (Benchmark Tests)" };
  // 198.51.100.0/24 (TEST-NET-2)
  if (a === 198 && b === 51 && c === 100) return { isPrivate: true, reason: "198.51.100.0/24 (Documentation/Test)" };
  // 203.0.113.0/24 (TEST-NET-3)
  if (a === 203 && b === 0 && c === 113) return { isPrivate: true, reason: "203.0.113.0/24 (Documentation/Test)" };
  // 224.0.0.0/4 (Multicast: 224.0.0.0 - 239.255.255.255)
  if (a >= 224 && a <= 239) return { isPrivate: true, reason: "224.0.0.0/4 (Multicast)" };
  // 240.0.0.0/4 (Reserved / Future Use)
  if (a >= 240) return { isPrivate: true, reason: "240.0.0.0/4 (Reserved)" };
  // Alibaba Cloud metadata: 100.100.100.200
  if (a === 100 && b === 100 && c === 100 && d === 200) return { isPrivate: true, reason: "Cloud Metadata (100.100.100.200)" };

  return { isPrivate: false };
}

/**
 * Parses IPv4 octet string supporting decimal, hex, and octal notations.
 */
function parseIpv4Octet(part: string): number | null {
  const trimmed = part.trim();
  if (!trimmed) return null;

  let val: number;
  if (/^0x[0-9a-f]+$/i.test(trimmed)) {
    val = parseInt(trimmed, 16);
  } else if (/^0[0-7]+$/.test(trimmed)) {
    val = parseInt(trimmed, 8);
  } else if (/^\d+$/.test(trimmed)) {
    val = parseInt(trimmed, 10);
  } else {
    return null;
  }

  if (isNaN(val) || val < 0 || val > 4294967295) return null;
  return val;
}

/**
 * Parses any standard or alternative IPv4 representation into [a, b, c, d].
 */
function parseIpv4(host: string): [number, number, number, number] | null {
  const clean = host.trim();
  if (!clean) return null;

  // Single number (decimal dword, hex integer, octal integer)
  if (/^(0x[0-9a-f]+|\d+)$/i.test(clean)) {
    const num = parseIpv4Octet(clean);
    if (num === null) return null;
    return [(num >>> 24) & 255, (num >>> 16) & 255, (num >>> 8) & 255, num & 255];
  }

  const parts = clean.split(".");
  if (parts.length > 4 || parts.length < 2) return null;

  const parsedParts: number[] = [];
  for (const p of parts) {
    const oct = parseIpv4Octet(p);
    if (oct === null) return null;
    parsedParts.push(oct);
  }

  if (parsedParts.length === 4) {
    if (parsedParts.some((p) => p > 255)) return null;
    return [parsedParts[0], parsedParts[1], parsedParts[2], parsedParts[3]];
  }

  if (parsedParts.length === 3) {
    // a.b.c -> a, b, (c as 16-bit)
    if (parsedParts[0] > 255 || parsedParts[1] > 255 || parsedParts[2] > 65535) return null;
    return [parsedParts[0], parsedParts[1], (parsedParts[2] >>> 8) & 255, parsedParts[2] & 255];
  }

  if (parsedParts.length === 2) {
    // a.b -> a, (b as 24-bit)
    if (parsedParts[0] > 255 || parsedParts[1] > 16777215) return null;
    return [
      parsedParts[0],
      (parsedParts[1] >>> 16) & 255,
      (parsedParts[1] >>> 8) & 255,
      parsedParts[1] & 255,
    ];
  }

  return null;
}

/**
 * Parses IPv6 address into 8 16-bit words.
 */
function parseIpv6(host: string): { words: number[]; ipv4Mapped?: [number, number, number, number] } | null {
  let clean = host.trim();
  if (clean.startsWith("[") && clean.endsWith("]")) {
    clean = clean.slice(1, -1);
  }
  if (!clean.includes(":")) return null;

  // Handle embedded IPv4 at the end (e.g. ::ffff:192.168.1.1 or ::127.0.0.1)
  let ipv4Mapped: [number, number, number, number] | undefined;
  const lastColon = clean.lastIndexOf(":");
  const lastPart = clean.slice(lastColon + 1);
  if (lastPart.includes(".")) {
    const parsedV4 = parseIpv4(lastPart);
    if (!parsedV4) return null;
    ipv4Mapped = parsedV4;
    // Replace the IPv4 part with two hex words
    const hex1 = ((parsedV4[0] << 8) | parsedV4[1]).toString(16);
    const hex2 = ((parsedV4[2] << 8) | parsedV4[3]).toString(16);
    clean = clean.slice(0, lastColon + 1) + hex1 + ":" + hex2;
  }

  const doubleColonIndex = clean.indexOf("::");
  if (doubleColonIndex !== -1) {
    if (clean.indexOf("::", doubleColonIndex + 1) !== -1) {
      return null; // More than one "::" is invalid
    }
    const left = clean.slice(0, doubleColonIndex).split(":").filter(Boolean);
    const right = clean.slice(doubleColonIndex + 2).split(":").filter(Boolean);
    const totalPresent = left.length + right.length;
    if (totalPresent > 7) return null;

    const missing = 8 - totalPresent;
    const middle = new Array(missing).fill("0");
    const full = [...left, ...middle, ...right];

    const words: number[] = [];
    for (const w of full) {
      if (!/^[0-9a-f]{1,4}$/i.test(w)) return null;
      words.push(parseInt(w, 16));
    }
    return { words, ipv4Mapped };
  } else {
    const parts = clean.split(":");
    if (parts.length !== 8) return null;
    const words: number[] = [];
    for (const w of parts) {
      if (!/^[0-9a-f]{1,4}$/i.test(w)) return null;
      words.push(parseInt(w, 16));
    }
    return { words, ipv4Mapped };
  }
}

/**
 * Checks if an IPv6 address falls within private, loopback, link-local, unique-local, or cloud metadata ranges.
 */
function isPrivateIpv6(parsed: { words: number[]; ipv4Mapped?: [number, number, number, number] }): {
  isPrivate: boolean;
  reason?: string;
} {
  const { words, ipv4Mapped } = parsed;

  // IPv6 Unspecified (::)
  if (words.every((w) => w === 0)) {
    return { isPrivate: true, reason: "IPv6 Unspecified (::)" };
  }

  // IPv6 Loopback (::1)
  if (words.slice(0, 7).every((w) => w === 0) && words[7] === 1) {
    return { isPrivate: true, reason: "IPv6 Loopback (::1)" };
  }

  // IPv6-mapped IPv4 (::ffff:0:0/96 or ::ffff:x.x.x.x)
  if (words.slice(0, 5).every((w) => w === 0) && words[5] === 0xffff) {
    const v4 = ipv4Mapped || [
      (words[6] >>> 8) & 255,
      words[6] & 255,
      (words[7] >>> 8) & 255,
      words[7] & 255,
    ];
    const v4Check = isPrivateIpv4(v4[0], v4[1], v4[2], v4[3]);
    if (v4Check.isPrivate) {
      return { isPrivate: true, reason: `IPv6-mapped IPv4 private: ${v4Check.reason}` };
    }
  }

  // IPv4-compatible IPv6 (deprecated ::x.x.x.x)
  if (words.slice(0, 6).every((w) => w === 0) && (words[6] !== 0 || words[7] > 1)) {
    const v4 = ipv4Mapped || [
      (words[6] >>> 8) & 255,
      words[6] & 255,
      (words[7] >>> 8) & 255,
      words[7] & 255,
    ];
    const v4Check = isPrivateIpv4(v4[0], v4[1], v4[2], v4[3]);
    if (v4Check.isPrivate) {
      return { isPrivate: true, reason: `IPv4-compatible IPv6 private: ${v4Check.reason}` };
    }
  }

  // IPv6 Link-Local unicast (fe80::/10)
  if ((words[0] & 0xffc0) === 0xfe80) {
    return { isPrivate: true, reason: "IPv6 Link-Local (fe80::/10)" };
  }

  // IPv6 Unique Local Address (fc00::/7 — covers fc00::/8 and fd00::/8)
  if ((words[0] & 0xfe00) === 0xfc00) {
    return { isPrivate: true, reason: "IPv6 Unique Local Address (fc00::/7)" };
  }

  // IPv6 Multicast (ff00::/8)
  if ((words[0] & 0xff00) === 0xff00) {
    return { isPrivate: true, reason: "IPv6 Multicast (ff00::/8)" };
  }

  // IPv6 Documentation (2001:db8::/32)
  if (words[0] === 0x2001 && words[1] === 0x0db8) {
    return { isPrivate: true, reason: "IPv6 Documentation (2001:db8::/32)" };
  }

  // IPv6 Discard prefix (100::/64)
  if (words[0] === 0x0100 && words[1] === 0 && words[2] === 0 && words[3] === 0) {
    return { isPrivate: true, reason: "IPv6 Discard (100::/64)" };
  }

  return { isPrivate: false };
}

/**
 * Validates a target URL against SSRF attack vectors.
 *
 * @param urlStr - The URL string to validate.
 * @returns UrlValidationResult with `{ valid: true }` or `{ valid: false, error: string }`.
 */
export function validatePublicUrl(urlStr: string): UrlValidationResult {
  if (!urlStr || typeof urlStr !== "string") {
    return { valid: false, error: "URL must be a non-empty string" };
  }

  const trimmed = urlStr.trim();

  // Parse using WHATWG URL standard
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }

  // 1. Enforce strict HTTP/HTTPS protocol
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      valid: false,
      error: `Invalid protocol '${parsed.protocol}'. Only http: and https: are allowed.`,
    };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!hostname) {
    return { valid: false, error: "URL host is missing or invalid." };
  }

  // 2. Reject credentials in URL authority
  if (parsed.username || parsed.password) {
    return { valid: false, error: "Userinfo / credentials in URL authority are not allowed." };
  }

  // 3. Block well-known cloud metadata and local hostnames
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return { valid: false, error: `Access to blocked host '${hostname}' is forbidden.` };
  }

  // 4. Block DNS rebinding wildcard domains and internal suffixes
  for (const suffix of BLOCKED_DOMAIN_SUFFIXES) {
    if (hostname === suffix || hostname.endsWith(suffix)) {
      return {
        valid: false,
        error: `Access to DNS rebinding or internal domain '${hostname}' is forbidden.`,
      };
    }
  }

  // 5. Detect non-standard numeric notations (hex, octal, decimal dword) in raw host
  const rawHostMatch = trimmed.match(/^https?:\/\/([^/?#:]+)/i);
  const rawHost = rawHostMatch ? rawHostMatch[1].toLowerCase() : hostname;

  const hasHex = /0x[0-9a-f]+/i.test(rawHost);
  const hasOctal = /(?:^|\.)0[0-7]+/.test(rawHost);
  const isDecimalDword = /^\d+$/.test(rawHost);

  if (hasHex || hasOctal || isDecimalDword) {
    // Resolve underlying IP to check if it points to private/loopback address
    const ipv4 = parseIpv4(rawHost);
    if (ipv4) {
      const v4Check = isPrivateIpv4(ipv4[0], ipv4[1], ipv4[2], ipv4[3]);
      if (v4Check.isPrivate) {
        return {
          valid: false,
          error: `Non-standard IP notation resolving to private network: ${v4Check.reason}`,
        };
      }
    }
    return {
      valid: false,
      error: "Non-standard IP notation (hex/octal/dword) is not allowed.",
    };
  }

  // 6. Validate IPv4 address if hostname is an IPv4 or normalized to IPv4
  const ipv4 = parseIpv4(hostname);
  if (ipv4) {
    const v4Check = isPrivateIpv4(ipv4[0], ipv4[1], ipv4[2], ipv4[3]);
    if (v4Check.isPrivate) {
      return { valid: false, error: `Access to private IPv4 address is forbidden: ${v4Check.reason}` };
    }
    return { valid: true };
  }

  // 7. Validate IPv6 address if hostname is an IPv6
  const ipv6 = parseIpv6(hostname);
  if (ipv6) {
    const v6Check = isPrivateIpv6(ipv6);
    if (v6Check.isPrivate) {
      return { valid: false, error: `Access to private IPv6 address is forbidden: ${v6Check.reason}` };
    }
    return { valid: true };
  }

  return { valid: true };
}

/**
 * Asserts that a URL is a valid public HTTP/HTTPS URL, throwing an Error if invalid.
 */
export function assertPublicHttpUrl(urlStr: string): void {
  const result = validatePublicUrl(urlStr);
  if (!result.valid) {
    throw new Error(result.error || "Requests to local or private network addresses are not allowed.");
  }
}
