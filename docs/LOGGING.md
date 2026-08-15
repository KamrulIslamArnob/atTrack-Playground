# Logging and observability

atTrack writes structured NDJSON — one JSON object per line — for every
server-side path: HTTP requests, database queries, outbound third-party calls,
audit events, and the full decision trail of every AI request.

Client components and `scripts/` keep plain `console.*`. The logger imports
`node:fs` and must never reach a browser bundle.

## Where the log lives

```
<SQLITE_DIR or repo root>/.data/logs/attrack-YYYY-MM-DD.log
```

Beside the SQLite database, so a packaged Electron install keeps its logs in
the folder the user chose at setup rather than next to a read-only app bundle.
Both `.data/` and `logs/` are gitignored.

Files older than `ATTRACK_LOG_RETENTION_DAYS` (default 7) are deleted at boot.
In development the same lines are also printed to stdout in a readable form.

## Event taxonomy

Every line carries `event`, plus `app`, `env`, `level` and `time`.

| Prefix | Emitted by | Correlated by |
|---|---|---|
| `app.*` | boot, unhandled server errors | — |
| `http.*` | route handlers, via `withRoute` | `reqId` |
| `db.*` | `QueryBuilder.execute`, migrations | `reqId` |
| `net.*` | outbound calls, via `fetchWithLog` | `reqId`, `traceId` |
| `audit.*` | consequential Server Actions | `reqId` |
| `ai.*` | the whole AI pipeline | `traceId` |

`reqId` comes from `lib/log/request.ts` — a `React.cache()`, so every caller
inside one server request shares it with no parameter threading. `traceId` is
minted once per AI request and shared by every event that request causes.

### AI events

One chat turn produces this sequence, all sharing a `traceId`:

| Event | Answers |
|---|---|
| `ai.request.start` | who asked, which persona/agent, how big the prompt |
| `ai.route.model` | `auto` resolved to which model, and **which rule fired** |
| `ai.route.provider` | which provider was promoted to the head of the fallback chain, and **why** |
| `ai.intent` | which of the nine intents, decided by heuristic or LLM |
| `ai.retrieval` | which workspace sources were pulled, how many documents |
| `ai.route.tools` | tool path or plain stream, and the inputs to that decision |
| `ai.tool.call` | each tool, its duration, its argument **names** |
| `ai.provider.hop` | each provider attempt, with `ttftMs` and whether it fell through |
| `ai.usage` | tokens in/out and **what it cost** |
| `ai.request.end` | outcome and total duration |

A trace that starts and never ends is the signal worth alerting on.
`scripts/verify-logging.ts` asserts the pairing.

Cost comes from `lib/ai/pricing.ts`. An unpriced model records
`costUsd: null` with `pricing: "unknown"` — never `0`, which would read as
free. If a model shows up as unknown, add it to `MODEL_PRICES`.

## What is never logged

Design rules, not conventions. `scripts/verify-logging.ts` enforces them.

**Never**: prompts, message text, model output, retrieved document text, tool
argument *values*, row data, SQL text, database filter *values*, email
addresses, subject lines, message bodies, file contents, URL query strings.

**Instead**: counts, string lengths, argument *names*, column *names*, table
names, enum values, ids, durations, status codes.

**Secrets** are stopped twice: pino `redact` censors `api_key`, `apiKey`,
`encrypted_api_key`, `authorization`, `token`, `password`, `sourceConfig`,
`smtp` and `cookie` by path, and the `err` serializer runs `scrubSecrets()`
over every error message and stack, because a provider error routinely echoes
the request URL. `sourceConfig` is redacted wholesale — it holds a GitHub
token and an Obsidian vault path.

## Adding a log call

```ts
import { moduleLogger } from "@/lib/log";
const log = moduleLogger("actions.jobs");

log.error({ err, reqId: requestId() }, "Couldn't update job state:");
```

Pass the `Error` as `err` — the serializer handles type, message and stack.
For AI paths use the typed emitters in `lib/log/ai-events.ts` instead
(`aiEvent`, `aiWarn`, `aiSpan`); they never throw and are never awaited.

Never `await` a log call in a request or stream path. Awaiting telemetry
inside the streaming loop stalls token delivery to the user.

## Verifying

```bash
node scripts/verify-logging.ts
```

Exercise the app first (a chat turn with tools, a job import, a resume score).
The script asserts no credential pattern appears anywhere in the log, no
content-bearing field names are present, every `ai.*` line carries a
`traceId`, every trace is closed, and no priced model was recorded at `$0`.

## The drain (opt-in, off by default)

The log file is a record of the user's own job search. Nothing is shipped
anywhere unless `ATTRACK_LOG_DRAIN_URL` is set; without it the drain starts no
timer, opens no file and makes no network call.

It is deliberately not a pino transport. `lib/log/drain.ts` tails the NDJSON
file on a timer, wholly outside the request path, batching on
`ATTRACK_LOG_DRAIN_BATCH` lines or `ATTRACK_LOG_DRAIN_INTERVAL_MS`. The byte
offset is persisted in `.data/logs/.drain-cursor` and **only advances after a
2xx**, so a failing endpoint costs delay, never lines. The drain also refuses
to ship its own log lines — otherwise a dead endpoint would append an error,
which becomes new work, which fails, which appends another.

No vendor SDK. Every supported destination is an HTTP POST:

```bash
# Axiom
ATTRACK_LOG_DRAIN_URL=https://api.axiom.co/v1/datasets/attrack/ingest
ATTRACK_LOG_DRAIN_TOKEN=xaat-your-token

# Better Stack
ATTRACK_LOG_DRAIN_URL=https://in.logs.betterstack.com
ATTRACK_LOG_DRAIN_TOKEN=your-source-token

# Datadog — no bearer token; uses its own header
ATTRACK_LOG_DRAIN_URL=https://http-intake.logs.datadoghq.com/api/v2/logs
ATTRACK_LOG_DRAIN_FORMAT=json-array
ATTRACK_LOG_DRAIN_HEADERS={"DD-API-KEY":"your-key"}
```

Every variable and its default is listed in [`.env.example`](../.env.example).
