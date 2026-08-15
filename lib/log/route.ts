// Route-handler logging wrapper.
//
// Wrap an exported handler and every request through it reports method,
// route, status and duration under a shared requestId. The wrapper is
// transparent: it returns the handler's own Response and re-throws its own
// error unchanged, so Next's error handling is untouched.
//
// Note on streaming routes (/api/chat): durationMs measures time to the
// Response object, which for an SSE route is time-to-first-byte, not the
// life of the stream. The per-turn total lives in the ai.request.end event.

import { moduleLogger } from "@/lib/log";
import { requestId } from "@/lib/log/request";

const httpLog = moduleLogger("http");

type Handler<A extends unknown[]> = (req: Request, ...args: A) => Promise<Response> | Response;

export function withRoute<A extends unknown[]>(route: string, handler: Handler<A>): Handler<A> {
  return async (req: Request, ...args: A): Promise<Response> => {
    const startedAt = Date.now();
    const base = { event: "http.request", route, method: req.method, reqId: requestId() };

    try {
      const res = await handler(req, ...args);
      const durationMs = Date.now() - startedAt;
      httpLog[res.status >= 500 ? "error" : res.status >= 400 ? "warn" : "info"]({
        ...base,
        status: res.status,
        durationMs,
      });
      return res;
    } catch (err) {
      httpLog.error({ ...base, status: 500, durationMs: Date.now() - startedAt, err });
      throw err;
    }
  };
}
