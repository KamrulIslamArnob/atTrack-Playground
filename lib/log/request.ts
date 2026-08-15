// Per-request correlation id.
//
// `cache()` is scoped to a single server request in the App Router, so the
// first caller in a request creates the id and every later caller — route
// handler, Server Component, Server Action, anything downstream — gets the
// same one back with no wrapper and no parameter threading through the
// twenty-eight files in lib/actions.
//
// Outside a request scope (a background task from lib/ai/background.ts, a
// script, instrumentation's boot hook) React falls back to per-call memo, so
// each caller simply gets its own id. That is the correct reading: those runs
// genuinely are not one request.

import { cache } from "react";

export const requestId = cache((): string => crypto.randomUUID());
