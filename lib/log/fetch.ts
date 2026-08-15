// Outbound third-party call logging.
//
// Wraps fetch so every call to an AI provider, Firecrawl, GitHub or a web
// search endpoint reports host, status and duration. Behaviour is byte-for-
// byte the same as calling fetch directly: same arguments, same Response,
// same thrown error. It only observes.
//
// The URL is logged as origin + pathname ONLY. Query strings routinely carry
// API keys and the user's own search text; neither belongs in a log file.

import { moduleLogger } from "@/lib/log";

const netLog = moduleLogger("net");

function safeUrl(input: RequestInfo | URL): { host: string; path: string } {
  try {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw);
    return { host: url.host, path: url.pathname };
  } catch {
    return { host: "unknown", path: "" };
  }
}

export async function fetchWithLog(
  input: RequestInfo | URL,
  init?: RequestInit,
  meta?: { service?: string; traceId?: string }
): Promise<Response> {
  const { host, path } = safeUrl(input);
  const base = {
    event: "net.call",
    service: meta?.service ?? host,
    host,
    path,
    method: init?.method ?? "GET",
    ...(meta?.traceId ? { traceId: meta.traceId } : {}),
  };
  const startedAt = Date.now();

  try {
    const res = await fetch(input, init);
    const durationMs = Date.now() - startedAt;
    // A 4xx/5xx is a real signal but not an exception — the provider chain
    // reads the body and decides. Log it louder without changing the flow.
    netLog[res.ok ? "debug" : "warn"]({ ...base, status: res.status, durationMs });
    return res;
  } catch (err) {
    netLog.warn({ ...base, durationMs: Date.now() - startedAt, err });
    throw err;
  }
}
