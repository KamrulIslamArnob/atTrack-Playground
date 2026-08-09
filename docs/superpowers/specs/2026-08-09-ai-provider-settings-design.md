# AI Provider Settings — Design

## Problem

AtTrack's AI layer is hardcoded to a single Gemini client (`lib/ai/gemini.ts`, one `GEMINI_API_KEY` env var). The user wants to configure their own AI providers from Settings — multiple providers, multiple models per provider — and choose which provider(s) serve each of three task categories:

- **Text** — everything text-in/JSON-or-text-out: resume extraction, resume/job match scoring, MCQ generation, application email drafting, AI Tools drafting.
- **Scraping** — job-posting extraction (`extractJob`), including fetching a job-posting URL as a source.
- **Image** — reserved for a future feature; no current call site consumes it. Settings must let the user configure it anyway so it's ready when a consumer exists.

Multiple providers/models can be enabled for one task type; when they are, they form an **ordered fallback chain** — the first one is tried, and on error the next is tried, and so on.

## Non-goals

- No image-generation call site is being wired in this change. The config exists and saves; nothing calls it yet.
- No mid-stream provider fallback for the two SSE routes (`generate-email`, `generate-ai-tool`). Once a stream has started, a failure ends the request — restarting output the user has already started reading isn't sound. Only the *first* provider in a task's chain is used for streaming calls.
- No new provider SDKs. Anthropic and OpenAI-compatible providers are called with plain `fetch` against their REST APIs (both are simple JSON), so no `@anthropic-ai/sdk` or `openai` package is added. Gemini keeps using the existing `@google/genai` SDK.
- "Custom" provider is not a fourth distinct type. A custom OpenAI-compatible endpoint (self-hosted, Ollama, a proxy, anything not in the preset quick-fill list) is just an `openai_compatible` row with a hand-typed `base_url`. There is no separate "custom" `provider_type` value.
- No enumeration/validation of model names against a provider's live model list. The `model` field is free text — providers and their catalogs change too often to hardcode, and there's no single API across Gemini/Anthropic/OpenAI-compatible endpoints to list them uniformly.

## Data model

Two new tables in `lib/db/schema.sql` (new tables only, `CREATE TABLE IF NOT EXISTS` — no `COLUMN_MIGRATIONS` entries needed since nothing is added to an existing table):

```sql
CREATE TABLE IF NOT EXISTS ai_providers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  provider_type TEXT NOT NULL CHECK (provider_type IN ('gemini', 'anthropic', 'openai_compatible')),
  base_url TEXT,              -- required for openai_compatible, NULL otherwise
  model TEXT NOT NULL,
  encrypted_api_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS ai_task_routes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  task_type TEXT NOT NULL CHECK (task_type IN ('text', 'image', 'scraping')),
  provider_ids TEXT NOT NULL DEFAULT '[]',  -- JSON array of ai_providers.id, ordered = fallback order
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (user_id, task_type)
);
```

`provider_ids` is registered in `lib/db/meta.ts` as a JSON column (same pattern as every other JSON column in the app).

Every read/write against both tables carries `.eq("user_id", userId)`, per the repo's SQLite scoping convention.

## Encryption

`ai_providers.encrypted_api_key` reuses `lib/encryption.ts` (`encrypt`/`decrypt`, AES-256-GCM) and the existing `SMTP_ENCRYPTION_KEY` env var — the same key already encrypts SMTP passwords, and one key can hold multiple secret categories safely. No new env var.

## Server actions — `lib/actions/ai-providers.ts`

Standard shape (auth → query → activity log), mirroring `lib/actions/smtp.ts`:

- `listProviders(): Promise<ProviderSummary[]>` — never returns the decrypted key to the client, only `{ id, name, provider_type, base_url, model }`.
- `createProvider(formData)` / `updateProvider(id, formData)` — API key field is optional on update ("leave blank to keep existing"), same UX as the SMTP password field.
- `deleteProvider(id)` — also strips the id out of any `ai_task_routes.provider_ids` that reference it, so a route never points at a deleted provider.
- `getTaskRoutes(): Promise<Record<TaskType, ProviderSummary[]>>` — resolves each route's `provider_ids` to full provider rows, in order.
- `saveTaskRoute(taskType: TaskType, providerIds: string[])`.

## Provider dispatch — new `lib/ai/providers.ts`

This is the abstraction every AI call site routes through instead of talking to `lib/ai/gemini.ts` directly.

- `resolveProviderChain(userId, taskType): Promise<ResolvedProvider[]>` — reads the task's route, decrypts each provider's key. **If the chain is empty** (nothing configured for that task — the zero-config case), it falls back to a single synthetic Gemini provider built from `process.env.GEMINI_API_KEY`, preserving today's out-of-box behavior exactly.
- `generateText({ chain, systemPrompt, userPrompt, images? }): Promise<{ text, providerName, model, usage }>` — walks the chain in order; on a hop's failure, logs that hop's error via the existing `logAiUsage` error path and tries the next hop; throws only once every hop has failed.
- `generateTextStream(...)` — same shape but SSE; only ever uses `chain[0]` (see Non-goals).
- Per-type callers, each normalizing to plain text (the way every current call site already parses JSON out of a text response — nothing here needs provider-native structured output/function-calling):
  - `callGemini` — `@google/genai`, same as today but constructed per-provider (own API key/model) instead of the single module-level singleton.
  - `callAnthropic` — `fetch("https://api.anthropic.com/v1/messages", ...)`.
  - `callOpenAICompatible` — `fetch(`${base_url}/chat/completions`, ...)`.
- `fetchUrlAsText(url): Promise<string>` — plain `fetch` + strip `<script>`/`<style>`/tags to text. This is the scraping-task substitute for Gemini's built-in `url_context` tool, used only when the resolved scraping provider isn't Gemini.

## Call sites rewired

| File | Task type | Change |
|---|---|---|
| `lib/ai/ai.ts` (`extractJob`) | `scraping` | Resolve chain for `scraping`. If the active hop is Gemini, keep today's `interactions.create` + `url_context` tool path unchanged. Otherwise, when a URL was given, `fetchUrlAsText` it first and fold the result into the prompt as pasted text, then call `generateText`. |
| `lib/ai/resume.ts` (`extractResumeContent`, `calculateMatchScore`) | `text` | Resolve chain for `text`, call `generateText`. |
| `lib/ai/mcq.ts` (`generateMCQQuestions`) | `text` | Same. |
| `app/api/ai/generate-email/route.ts`, `app/api/ai/generate-ai-tool/route.ts` | `text` | Resolve chain for `text`, call `generateTextStream`. |

Every site's `logAiUsage` call switches from the hardcoded `MODEL` constant to whatever `generateText`/`generateTextStream` reports actually served the request, so the AI-usage admin viewer keeps reflecting reality once multiple providers are in play.

## Settings UI

New Card on `/settings`, "AI Providers" (`components/settings/ai-providers-form.tsx` + supporting pieces), placed after the existing Email (SMTP) card, before Danger Zone.

- **Provider list**: each row shows name, type, model, base_url (if set); edit and delete actions. "Add provider" opens a dialog: type selector (Gemini / Anthropic / OpenAI-compatible), name, base URL (openai_compatible only, with quick-fill buttons for OpenAI/OpenRouter/Groq/Ollama/DeepSeek/Together that just populate the field), API key (password input, write-only), model (free text).
- **Task routing**: three sections, Text / Image / Scraping. Each is an ordered picker over the configured providers — add/remove plus up/down reorder buttons (no drag-and-drop library; matches the "shortest working diff" bar the rest of the app holds to). Order = fallback order.
- **Empty state**: a task section with nothing selected shows "Using default Gemini (from GEMINI_API_KEY)" instead of an error — configuring providers is opt-in, not required.

## Error handling

- A chain hop's failure (bad key, network error, non-2xx, malformed response) is caught, logged through `logAiUsage`'s existing error path tagged with which provider failed, and dispatch moves to the next hop.
- A decrypt failure on a stored key is treated the same as any other hop failure — skip, don't crash the whole chain.
- Only once every hop in the chain (including the zero-config Gemini fallback, when the chain was empty) has failed does the call site see a thrown error, same contract every call site already has today.

## Testing

No test framework exists in this repo (per `CLAUDE.md`) and the existing AI layer has zero automated tests — this change doesn't introduce a new convention. `node lib/db/selfcheck.ts` runs after the schema/meta changes, per repo convention. Manual smoke test after implementation: configure one `openai_compatible` provider against a real endpoint, confirm the email-drafting stream and the scraping fallback text path (non-Gemini provider + a job URL) both work end to end.
