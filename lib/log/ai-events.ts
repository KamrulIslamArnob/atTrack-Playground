// The AI observability contract.
//
// Every AI request emits a stream of one-line events sharing a `traceId`, so
// a single chat turn can be reassembled from the log: which model the auto
// router picked and why, which provider was promoted to the head of the
// fallback chain, what the intent classifier decided, what retrieval pulled,
// whether the tool path or the plain stream ran, every provider hop with its
// time-to-first-token, and what the whole turn cost.
//
// Rules that every emitter here must keep:
//   1. Never awaited. Emitting is a synchronous write to an fd; the streaming
//      loop must never pay a round-trip for telemetry (see the comment on
//      logUsageDetached in lib/ai/providers.ts).
//   2. Never throws. A logging bug must not become a failed generation.
//   3. Never carries user content. Prompts, retrieved documents, tool
//      arguments and model output are personal data — log their SHAPE
//      (counts, lengths, keys) and never their text.

import { moduleLogger } from "@/lib/log";

const aiLog = moduleLogger("ai");

export const AI_EVENTS = {
  requestStart: "ai.request.start",
  routeModel: "ai.route.model",
  routeProvider: "ai.route.provider",
  intent: "ai.intent",
  retrieval: "ai.retrieval",
  routeTools: "ai.route.tools",
  toolCall: "ai.tool.call",
  providerHop: "ai.provider.hop",
  usage: "ai.usage",
  requestEnd: "ai.request.end",
} as const;

export type AiEventName = (typeof AI_EVENTS)[keyof typeof AI_EVENTS];

export type AiFields = Record<string, unknown> & { traceId: string };

export function newTraceId(): string {
  return crypto.randomUUID();
}

/** Emit one AI event. Swallows its own failures by design — see rule 2. */
export function aiEvent(event: AiEventName, fields: AiFields, msg?: string): void {
  try {
    aiLog.info({ event, ...fields }, msg);
  } catch {
    /* telemetry must never break generation */
  }
}

/** Same, at warn level, for a recoverable step: a provider hop that failed
 *  and fell through to the next, a tool that threw, retrieval that gave up. */
export function aiWarn(event: AiEventName, fields: AiFields, err?: unknown, msg?: string): void {
  try {
    aiLog.warn({ event, ...(err !== undefined ? { err } : {}), ...fields }, msg);
  } catch {
    /* see above */
  }
}

/** Starts a timer and returns the emitter for its closing event, so a caller
 *  never has to keep its own `Date.now()` around.
 *
 *      const done = aiSpan(AI_EVENTS.intent, { traceId });
 *      ...
 *      done({ primary, method });          // adds durationMs automatically
 */
export function aiSpan(event: AiEventName, base: AiFields) {
  const startedAt = Date.now();
  return (fields: Record<string, unknown> = {}, msg?: string) => {
    aiEvent(event, { ...base, ...fields, durationMs: Date.now() - startedAt }, msg);
  };
}

/** Length of a string that must not itself be logged. Keeps "how big was the
 *  prompt" answerable without putting the prompt in the log. */
export function sizeOf(value: unknown): number {
  if (typeof value === "string") return value.length;
  if (value == null) return 0;
  try {
    return JSON.stringify(value).length;
  } catch {
    return -1;
  }
}

/** Argument NAMES only. A tool's argument values are the user's own search
 *  text, contact names and job titles — rule 3 puts them off limits, but the
 *  key set is what actually explains a routing decision. */
export function argKeys(args: unknown): string[] {
  return args && typeof args === "object" && !Array.isArray(args) ? Object.keys(args) : [];
}
