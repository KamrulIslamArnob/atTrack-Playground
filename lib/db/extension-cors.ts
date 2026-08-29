/**
 * Validates whether an origin is a trusted browser extension or local loopback origin.
 * Supports:
 * - Chrome: chrome-extension://<extension-id>
 * - Firefox: moz-extension://<extension-id>
 * - Edge: edge-extension://<extension-id>
 * - Safari: safari-web-extension://<extension-id>
 * - Local loopback: localhost, 127.0.0.1, [::1] (http/https, any port)
 * - Missing origin (same-origin, Electron, or server-to-server — `fetch`
 *   simply omits the header in these cases, giving req.headers.get() a real
 *   JS `null`)
 *
 * Deliberately does NOT special-case the *literal string* "null": a browser
 * sends `Origin: null` for a sandboxed iframe, a `file://` page, or a data:
 * URI — all attacker-controllable contexts, not "no origin". Treating that
 * string the same as a genuinely absent header used to let such a page pass
 * this check (and, before the header-echo fix below, receive a matching
 * `Access-Control-Allow-Origin: null` back).
 */
export function isAllowedOrigin(origin: string | null | undefined): boolean {
  if (!origin) return true;

  // Browser extension schemes
  if (
    origin.startsWith("chrome-extension://") ||
    origin.startsWith("moz-extension://") ||
    origin.startsWith("edge-extension://") ||
    origin.startsWith("safari-web-extension://")
  ) {
    return true;
  }

  // Local loopback hostnames (IPv4, IPv6, localhost) on any port and protocol
  const loopbackRegex = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;
  if (loopbackRegex.test(origin)) {
    return true;
  }

  return false;
}

/**
 * Restricts CORS to valid browser extensions and local origins.
 * Blocks random internet websites from communicating with local API endpoints.
 */
export function getExtensionCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  const isAllowed = isAllowedOrigin(origin);

  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Vary": "Origin",
  };

  // Only ever echo back a concrete origin the request actually presented.
  // Never emit the literal string "null": some browsers treat
  // `Access-Control-Allow-Origin: null` as matching a request whose `Origin`
  // header is literally "null" (sandboxed iframes, `file://` pages, data:
  // URIs) — which would let such a page pass the browser's CORS check
  // against this local server. Omitting the header entirely for a
  // disallowed/absent origin denies by default instead. (The real
  // authorization boundary is verifyExtensionAuth's bearer secret, not this
  // header — this is defense in depth, not the load-bearing check.)
  if (isAllowed && origin) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

