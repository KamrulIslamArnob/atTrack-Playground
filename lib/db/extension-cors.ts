/**
 * Restricts CORS to valid browser extensions and local origins.
 * Blocks random internet websites from communicating with local port 3308.
 */
export function getExtensionCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");

  const isAllowed =
    !origin ||
    origin.startsWith("chrome-extension://") ||
    origin.startsWith("moz-extension://") ||
    origin === "http://localhost:3788" ||
    origin === "http://127.0.0.1:3788" ||
    origin === "http://localhost:3308" ||
    origin === "http://127.0.0.1:3308" ||
    origin === "http://localhost:3000" ||
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

  return {
    "Access-Control-Allow-Origin": isAllowed ? (origin || "*") : "null",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Vary": "Origin",
  };
}
