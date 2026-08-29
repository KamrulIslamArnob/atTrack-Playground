import { NextResponse, type NextRequest } from "next/server";

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "DELETE", "PATCH"]);

const ALLOWED_EXTENSION_SCHEMES = [
  "chrome-extension://",
  "moz-extension://",
  "edge-extension://",
  "safari-web-extension://",
];

/**
 * Extracts hostname from Host header, stripping port number.
 * Handles IPv6 bracket notation [::1]:3788 correctly.
 */
function extractHostname(hostHeader: string | null): string {
  if (!hostHeader) return "";
  const trimmed = hostHeader.trim();
  if (trimmed.startsWith("[")) {
    const closingBracket = trimmed.indexOf("]");
    if (closingBracket !== -1) {
      return trimmed.slice(0, closingBracket + 1).toLowerCase();
    }
  }
  return trimmed.split(":")[0].toLowerCase();
}

/**
 * Restricts incoming Host header to loopback addresses.
 */
function isAllowedHost(hostHeader: string | null, isDev: boolean): boolean {
  if (!hostHeader) return false;
  const hostname = extractHostname(hostHeader);
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname === "::1"
  ) {
    return true;
  }
  if (isDev && (hostname === "0.0.0.0" || hostname === "[::]" || hostname === "::")) {
    return true;
  }
  return false;
}

/**
 * Validates Origin header for state-changing HTTP requests.
 * Allows local loopback origins and authorized browser extension schemes.
 */
function isAllowedOrigin(origin: string | null, isDev: boolean): boolean {
  if (!origin) return true;
  const trimmed = origin.trim();
  if (trimmed === "null") return false;

  // Allow registered browser extension schemes
  for (const scheme of ALLOWED_EXTENSION_SCHEMES) {
    if (trimmed.startsWith(scheme)) return true;
  }

  // Validate HTTP/HTTPS origins
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]" ||
      hostname === "::1"
    ) {
      return true;
    }
    if (isDev && (hostname === "0.0.0.0" || hostname === "[::]" || hostname === "::")) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Global Security & Origin Proxy
 * - Restricts Host header to loopback addresses (127.0.0.1, localhost, [::1]).
 * - Validates Origin header for state-changing requests (POST, PUT, DELETE, PATCH).
 * - Excludes Next.js static assets and favicon from blocking.
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Exclude static assets
  if (
    pathname.startsWith("/_next/static") ||
    pathname.startsWith("/_next/image") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const isDev = process.env.NODE_ENV !== "production";

  // 2. Validate Host header against loopback addresses
  const hostHeader = req.headers.get("host") || req.nextUrl.host;
  if (!isAllowedHost(hostHeader, isDev)) {
    return new NextResponse("Forbidden: External or LAN Host header not allowed", {
      status: 403,
      headers: { "Content-Type": "text/plain" },
    });
  }

  // 3. Validate Origin header on state-changing requests
  const method = req.method.toUpperCase();
  if (STATE_CHANGING_METHODS.has(method)) {
    const originHeader = req.headers.get("origin");
    if (originHeader && !isAllowedOrigin(originHeader, isDev)) {
      return new NextResponse("Forbidden: Unauthorized Origin", {
        status: 403,
        headers: { "Content-Type": "text/plain" },
      });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - static image/font extensions
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)$).*)",
  ],
};
