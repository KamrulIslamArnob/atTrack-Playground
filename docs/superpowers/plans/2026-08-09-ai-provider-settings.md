# AI Provider Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user configure their own AI providers (Gemini / Anthropic / OpenAI-compatible) from Settings, and choose which provider(s) — as an ordered fallback chain — serve each of three task categories: Text, Image, Scraping.

**Architecture:** Two new SQLite tables (`ai_providers`, `ai_task_routes`) hold per-user provider credentials (AES-256-GCM encrypted, reusing `lib/encryption.ts`) and per-task-type ordered provider chains. A new dispatch module, `lib/ai/providers.ts`, resolves a task's chain and normalizes calls across all three provider kinds to plain text — every existing AI call site already regex-parses JSON out of a text response, so no provider-native structured-output/function-calling integration is needed. Existing AI call sites (`extractJob`, `extractResumeContent`, `calculateMatchScore`, `generateMCQQuestions`, the two SSE routes) are rewired to resolve a chain and call the dispatcher instead of talking to the hardcoded Gemini singleton. When nothing is configured for a task, the dispatcher falls back to today's single `GEMINI_API_KEY` behavior, so the app keeps working out of the box.

**Tech Stack:** Next.js 16 App Router, TypeScript, SQLite (`lib/db/`), `@google/genai` (Gemini only), plain `fetch` for Anthropic/OpenAI-compatible (no new SDK deps), Tailwind v4 + shadcn/ui.

## Global Constraints

- No new npm dependencies (Anthropic + OpenAI-compatible are called with `fetch`, not their SDKs).
- Every query against `ai_providers` / `ai_task_routes` carries `.eq("user_id", userId)` — SQLite has no row-level security (see `CLAUDE.md`).
- No new env var — `encrypted_api_key` reuses the existing `SMTP_ENCRYPTION_KEY`.
- "Custom" provider is not a distinct type — it's an `openai_compatible` row with a hand-typed `base_url`.
- Image task type gets full settings support but zero wired consumers in this plan — config saves and loads, nothing calls it.
- Streaming (`generate-email`, `generate-ai-tool`) only ever uses the *first* provider in a task's chain — no mid-stream fallback.
- No automated tests for network-calling code (matches the repo's existing zero-test AI layer). Pure logic (fallback-chain iteration, HTML stripping) gets one assert-based self-check file, matching `lib/db/selfcheck.ts`'s established pattern — no test framework is introduced.
- Run `node lib/db/selfcheck.ts` after any schema/meta change (per `CLAUDE.md`).

---

### Task 1: Schema, JSON column registration, and shared types

**Files:**
- Modify: `lib/db/schema.sql` (append after the `ai_usage_logs` block, e.g. after line 347)
- Modify: `lib/db/meta.ts`
- Create: `lib/types/ai-providers.ts`

**Interfaces:**
- Produces: `ProviderType = "gemini" | "anthropic" | "openai_compatible"`, `TaskType = "text" | "image" | "scraping"`, `PROVIDER_TYPES: readonly ProviderType[]`, `TASK_TYPES: readonly TaskType[]`, `PROVIDER_TYPE_LABELS: Record<ProviderType, string>`, `TASK_TYPE_LABELS: Record<TaskType, string>`, `OPENAI_COMPATIBLE_PRESETS: readonly {label: string; baseUrl: string}[]`, `interface AiProviderSummary { id: string; name: string; provider_type: ProviderType; base_url: string | null; model: string }` — every later task imports these from `@/lib/types/ai-providers`.

- [ ] **Step 1: Add the two tables to `lib/db/schema.sql`**

Insert this block immediately after the `ai_usage_logs` table + its indexes (after the line `CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created ON ai_usage_logs(created_at);`):

```sql
-- =============================================
-- ai_providers / ai_task_routes
-- =============================================
CREATE TABLE IF NOT EXISTS ai_providers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  provider_type TEXT NOT NULL CHECK (provider_type IN ('gemini', 'anthropic', 'openai_compatible')),
  base_url TEXT,
  model TEXT NOT NULL,
  encrypted_api_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_ai_providers_user ON ai_providers(user_id);

CREATE TABLE IF NOT EXISTS ai_task_routes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL CHECK (task_type IN ('text', 'image', 'scraping')),
  provider_ids TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (user_id, task_type)
);

CREATE INDEX IF NOT EXISTS idx_ai_task_routes_user ON ai_task_routes(user_id);
```

- [ ] **Step 2: Register `provider_ids` as a JSON column in `lib/db/meta.ts`**

In `JSON_COLUMNS`, add a new entry (anywhere in the object, e.g. after `ai_extraction_logs`):

```ts
  ai_task_routes: ["provider_ids"],
```

- [ ] **Step 3: Create `lib/types/ai-providers.ts`**

```ts
// Shared types for the AI provider settings feature (Settings > AI Providers).
// A "provider" is one configured credential (type + base URL + model + key);
// a "task route" is the ordered fallback chain of providers used for one of
// the three task categories below.

export const PROVIDER_TYPES = ["gemini", "anthropic", "openai_compatible"] as const;
export type ProviderType = (typeof PROVIDER_TYPES)[number];

export const PROVIDER_TYPE_LABELS: Record<ProviderType, string> = {
  gemini: "Gemini",
  anthropic: "Anthropic",
  openai_compatible: "OpenAI-compatible",
};

// task_type "image" has no wired call site yet — see plan Task 6 note. It's
// still fully configurable so it's ready the moment a consumer exists.
export const TASK_TYPES = ["text", "image", "scraping"] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  text: "Text",
  image: "Image",
  scraping: "Scraping",
};

// Quick-fill buttons for openai_compatible's base_url field. Picking one just
// populates the field — the stored provider_type is still "openai_compatible".
export const OPENAI_COMPATIBLE_PRESETS = [
  { label: "OpenAI", baseUrl: "https://api.openai.com/v1" },
  { label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1" },
  { label: "Groq", baseUrl: "https://api.groq.com/openai/v1" },
  { label: "DeepSeek", baseUrl: "https://api.deepseek.com/v1" },
  { label: "Together", baseUrl: "https://api.together.xyz/v1" },
  { label: "Ollama (local)", baseUrl: "http://localhost:11434/v1" },
] as const;

/** Client/UI-safe shape — never carries the decrypted (or encrypted) key. */
export interface AiProviderSummary {
  id: string;
  name: string;
  provider_type: ProviderType;
  base_url: string | null;
  model: string;
}
```

- [ ] **Step 4: Verify the schema loads cleanly**

Run: `node lib/db/selfcheck.ts`
Expected: all existing assertions print `ok` and the process exits 0 (this applies `schema.sql` to a fresh temp DB, so a syntax error in the new tables fails immediately here).

- [ ] **Step 5: Commit**

```bash
git add lib/db/schema.sql lib/db/meta.ts lib/types/ai-providers.ts
git commit -m "feat(ai-providers): add schema, JSON column registration, shared types

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Server actions — `lib/actions/ai-providers.ts`

**Files:**
- Create: `lib/actions/ai-providers.ts`

**Interfaces:**
- Consumes: `getUser()` from `@/lib/auth` (returns `{ supabase, userId }`); `encrypt`/`decrypt` from `@/lib/encryption`; `logResourceActivity` from `@/lib/actions/activity-log`; `PROVIDER_TYPES`, `TASK_TYPES`, `AiProviderSummary`, `ProviderType`, `TaskType` from `@/lib/types/ai-providers` (Task 1).
- Produces: `listProviders(): Promise<AiProviderSummary[]>`, `createProvider(params): Promise<{error?: string; id?: string}>`, `updateProvider(id, params): Promise<{error?: string}>`, `deleteProvider(id): Promise<{error?: string}>`, `getTaskRoutes(): Promise<Record<TaskType, AiProviderSummary[]>>`, `saveTaskRoute(taskType, providerIds): Promise<{error?: string}>` — Task 7 (Settings UI) calls all six directly from client components (they're `"use server"` exports, callable from `"use client"` code without a fetch wrapper, same as every other action in `lib/actions/`).

- [ ] **Step 1: Write `lib/actions/ai-providers.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { encrypt } from "@/lib/encryption";
import { logResourceActivity } from "@/lib/actions/activity-log";
import {
  PROVIDER_TYPES,
  TASK_TYPES,
  type AiProviderSummary,
  type ProviderType,
  type TaskType,
} from "@/lib/types/ai-providers";

interface ProviderRow {
  id: string;
  name: string;
  provider_type: ProviderType;
  base_url: string | null;
  model: string;
}

function toSummary(row: ProviderRow): AiProviderSummary {
  return {
    id: row.id,
    name: row.name,
    provider_type: row.provider_type,
    base_url: row.base_url,
    model: row.model,
  };
}

export async function listProviders(): Promise<AiProviderSummary[]> {
  const { supabase, userId } = await getUser();

  const { data } = await supabase
    .from("ai_providers")
    .select("id, name, provider_type, base_url, model")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  return ((data ?? []) as unknown as ProviderRow[]).map(toSummary);
}

export async function createProvider(params: {
  name: string;
  provider_type: ProviderType;
  base_url?: string | null;
  model: string;
  api_key: string;
}): Promise<{ error?: string; id?: string }> {
  const { supabase, userId } = await getUser();

  if (!PROVIDER_TYPES.includes(params.provider_type)) {
    return { error: "Invalid provider type." };
  }
  if (params.provider_type === "openai_compatible" && !params.base_url?.trim()) {
    return { error: "Base URL is required for OpenAI-compatible providers." };
  }
  if (!params.name.trim()) {
    return { error: "Name is required." };
  }
  if (!params.model.trim()) {
    return { error: "Model is required." };
  }
  if (!params.api_key.trim()) {
    return { error: "API key is required." };
  }

  const { data, error } = await supabase
    .from("ai_providers")
    .insert({
      user_id: userId,
      name: params.name.trim(),
      provider_type: params.provider_type,
      base_url: params.provider_type === "openai_compatible" ? params.base_url!.trim() : null,
      model: params.model.trim(),
      encrypted_api_key: encrypt(params.api_key.trim()),
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("Error creating AI provider:", error);
    return { error: "Failed to save provider." };
  }

  const id = (data as unknown as { id: string }).id;
  await logResourceActivity(userId, "create", "ai_provider", id, {
    name: params.name,
    provider_type: params.provider_type,
  });
  revalidatePath("/settings");
  return { id };
}

export async function updateProvider(
  id: string,
  params: {
    name: string;
    provider_type: ProviderType;
    base_url?: string | null;
    model: string;
    api_key?: string;
  }
): Promise<{ error?: string }> {
  const { supabase, userId } = await getUser();

  if (!PROVIDER_TYPES.includes(params.provider_type)) {
    return { error: "Invalid provider type." };
  }
  if (params.provider_type === "openai_compatible" && !params.base_url?.trim()) {
    return { error: "Base URL is required for OpenAI-compatible providers." };
  }

  const update: Record<string, unknown> = {
    name: params.name.trim(),
    provider_type: params.provider_type,
    base_url: params.provider_type === "openai_compatible" ? params.base_url!.trim() : null,
    model: params.model.trim(),
    updated_at: new Date().toISOString(),
  };
  if (params.api_key?.trim()) {
    update.encrypted_api_key = encrypt(params.api_key.trim());
  }

  const { error } = await supabase.from("ai_providers").update(update).eq("id", id).eq("user_id", userId);

  if (error) {
    console.error("Error updating AI provider:", error);
    return { error: "Failed to update provider." };
  }

  await logResourceActivity(userId, "update", "ai_provider", id, { name: params.name });
  revalidatePath("/settings");
  return {};
}

export async function deleteProvider(id: string): Promise<{ error?: string }> {
  const { supabase, userId } = await getUser();

  const { error } = await supabase.from("ai_providers").delete().eq("id", id).eq("user_id", userId);
  if (error) {
    console.error("Error deleting AI provider:", error);
    return { error: "Failed to delete provider." };
  }

  // A deleted provider must not linger inside any task's fallback chain.
  const { data: routes } = await supabase
    .from("ai_task_routes")
    .select("id, provider_ids")
    .eq("user_id", userId);

  for (const route of (routes ?? []) as unknown as { id: string; provider_ids: string[] }[]) {
    if (route.provider_ids.includes(id)) {
      await supabase
        .from("ai_task_routes")
        .update({ provider_ids: route.provider_ids.filter((p) => p !== id) })
        .eq("id", route.id)
        .eq("user_id", userId);
    }
  }

  await logResourceActivity(userId, "delete", "ai_provider", id);
  revalidatePath("/settings");
  return {};
}

export async function getTaskRoutes(): Promise<Record<TaskType, AiProviderSummary[]>> {
  const { supabase, userId } = await getUser();

  const [{ data: providers }, { data: routes }] = await Promise.all([
    supabase.from("ai_providers").select("id, name, provider_type, base_url, model").eq("user_id", userId),
    supabase.from("ai_task_routes").select("task_type, provider_ids").eq("user_id", userId),
  ]);

  const byId = new Map(((providers ?? []) as unknown as ProviderRow[]).map((p) => [p.id, toSummary(p)]));
  const routeByType = new Map(
    ((routes ?? []) as unknown as { task_type: TaskType; provider_ids: string[] }[]).map((r) => [
      r.task_type,
      r.provider_ids,
    ])
  );

  const result = {} as Record<TaskType, AiProviderSummary[]>;
  for (const taskType of TASK_TYPES) {
    const ids = routeByType.get(taskType) ?? [];
    result[taskType] = ids.map((id) => byId.get(id)).filter((p): p is AiProviderSummary => !!p);
  }
  return result;
}

export async function saveTaskRoute(taskType: TaskType, providerIds: string[]): Promise<{ error?: string }> {
  const { supabase, userId } = await getUser();

  if (!TASK_TYPES.includes(taskType)) {
    return { error: "Invalid task type." };
  }

  const { error } = await supabase.from("ai_task_routes").upsert(
    {
      user_id: userId,
      task_type: taskType,
      provider_ids: providerIds,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,task_type" }
  );

  if (error) {
    console.error("Error saving AI task route:", error);
    return { error: "Failed to save task routing." };
  }

  await logResourceActivity(userId, "update", "ai_task_route", undefined, {
    task_type: taskType,
    provider_ids: providerIds,
  });
  revalidatePath("/settings");
  return {};
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors from `lib/actions/ai-providers.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/actions/ai-providers.ts
git commit -m "feat(ai-providers): add CRUD + task-routing server actions

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Provider dispatch engine — `lib/ai/providers.ts`

**Files:**
- Create: `lib/ai/providers.ts`
- Create: `lib/ai/providers.selfcheck.ts`

**Interfaces:**
- Consumes: `createAdminClient` from `@/lib/supabase/admin`; `decrypt` from `@/lib/encryption`; `logAiUsage` from `@/lib/actions/ai-usage`; `ProviderType`, `TaskType` from `@/lib/types/ai-providers` (Task 1).
- Produces (consumed by Tasks 4–6): `interface ResolvedProvider { id: string; name: string; provider_type: ProviderType; base_url: string | null; model: string; api_key: string }`; `resolveProviderChain(userId: string, taskType: TaskType): Promise<ResolvedProvider[]>`; `interface GenerateTextInput { systemPrompt?: string; userPrompt: string; images?: { mimeType: string; data: string }[] }`; `interface GenerateTextResult { text: string; providerName: string; model: string; inputTokens?: number; outputTokens?: number }`; `generateText(chain: ResolvedProvider[], input: GenerateTextInput, logContext: { userId?: string; action: string; metadata?: Record<string, unknown> }): Promise<GenerateTextResult>`; `generateTextStream(chain: ResolvedProvider[], input: GenerateTextInput, logContext: same): Promise<ReadableStream<Uint8Array>>`; `fetchUrlAsText(url: string): Promise<string>`; `stripHtml(html: string): string`; `runChain(chain, input, logContext, resolveCaller: (t: ProviderType) => HopCaller): Promise<GenerateTextResult>` (exported only so the self-check can inject fake callers instead of hitting real provider APIs); `callGemini`, `callAnthropic`, `callOpenAICompatible` (each `(provider: ResolvedProvider, input: GenerateTextInput) => Promise<GenerateTextResult>`, exported for the self-check's type reference only, not meant to be called directly by other modules — use `generateText`/`generateTextStream` instead).

- [ ] **Step 1: Write `lib/ai/providers.ts`**

```ts
import { GoogleGenAI } from "@google/genai";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/encryption";
import { logAiUsage } from "@/lib/actions/ai-usage";
import type { ProviderType, TaskType } from "@/lib/types/ai-providers";

export interface ResolvedProvider {
  id: string;
  name: string;
  provider_type: ProviderType;
  base_url: string | null;
  model: string;
  api_key: string;
}

interface ProviderRow {
  id: string;
  name: string;
  provider_type: ProviderType;
  base_url: string | null;
  model: string;
  encrypted_api_key: string;
}

const DEFAULT_GEMINI_MODEL = "models/gemini-2.0-flash";

/** Zero-config fallback: today's single hardcoded Gemini client, used
 *  whenever a task has no configured chain — keeps the app working out of
 *  the box with nothing but GEMINI_API_KEY set. */
function defaultGeminiProvider(): ResolvedProvider | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return {
    id: "default-gemini",
    name: "Gemini (default)",
    provider_type: "gemini",
    base_url: null,
    model: DEFAULT_GEMINI_MODEL,
    api_key: apiKey,
  };
}

/** Resolves a task's ordered fallback chain, decrypting each provider's key.
 *  A key that fails to decrypt, or a route pointing at a deleted provider, is
 *  skipped like any other unusable hop rather than failing the whole chain. */
export async function resolveProviderChain(userId: string, taskType: TaskType): Promise<ResolvedProvider[]> {
  const admin = createAdminClient();

  const { data: route } = await admin
    .from("ai_task_routes")
    .select("provider_ids")
    .eq("user_id", userId)
    .eq("task_type", taskType)
    .maybeSingle();

  const providerIds = (route as unknown as { provider_ids: string[] } | null)?.provider_ids ?? [];
  if (providerIds.length === 0) {
    const fallback = defaultGeminiProvider();
    return fallback ? [fallback] : [];
  }

  const { data: providers } = await admin
    .from("ai_providers")
    .select("id, name, provider_type, base_url, model, encrypted_api_key")
    .eq("user_id", userId)
    .in("id", providerIds);

  const byId = new Map(((providers ?? []) as unknown as ProviderRow[]).map((p) => [p.id, p]));

  const resolved: ResolvedProvider[] = [];
  for (const id of providerIds) {
    const row = byId.get(id);
    if (!row) continue;
    try {
      resolved.push({ ...row, api_key: decrypt(row.encrypted_api_key) });
    } catch {
      // skip an unusable key, don't crash the whole chain
    }
  }

  if (resolved.length === 0) {
    const fallback = defaultGeminiProvider();
    if (fallback) resolved.push(fallback);
  }

  return resolved;
}

export interface GenerateTextInput {
  systemPrompt?: string;
  userPrompt: string;
  images?: { mimeType: string; data: string }[];
}

export interface GenerateTextResult {
  text: string;
  providerName: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
}

type HopCaller = (provider: ResolvedProvider, input: GenerateTextInput) => Promise<GenerateTextResult>;

export async function callGemini(provider: ResolvedProvider, input: GenerateTextInput): Promise<GenerateTextResult> {
  const ai = new GoogleGenAI({ apiKey: provider.api_key });
  const prompt = [input.systemPrompt, input.userPrompt].filter(Boolean).join("\n\n");

  const parts: unknown[] = (input.images ?? []).map((img) => ({
    inlineData: { mimeType: img.mimeType, data: img.data },
  }));
  parts.push({ text: prompt });

  const response = await ai.models.generateContent({
    model: provider.model,
    contents: [{ role: "user", parts }],
  });

  const text = response.text;
  if (!text) throw new Error(`${provider.name}: no text content in response`);

  return {
    text,
    providerName: provider.name,
    model: provider.model,
    inputTokens: response.usageMetadata?.promptTokenCount,
    outputTokens: response.usageMetadata?.candidatesTokenCount,
  };
}

export async function callAnthropic(provider: ResolvedProvider, input: GenerateTextInput): Promise<GenerateTextResult> {
  const content: unknown[] = (input.images ?? []).map((img) => ({
    type: "image",
    source: { type: "base64", media_type: img.mimeType, data: img.data },
  }));
  content.push({ type: "text", text: input.userPrompt });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": provider.api_key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: provider.model,
      max_tokens: 8192,
      ...(input.systemPrompt ? { system: input.systemPrompt } : {}),
      messages: [{ role: "user", content }],
    }),
  });

  if (!res.ok) {
    throw new Error(`${provider.name}: ${res.status} ${await res.text()}`);
  }

  const json = await res.json();
  const text = (json.content ?? [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("");
  if (!text) throw new Error(`${provider.name}: no text content in response`);

  return {
    text,
    providerName: provider.name,
    model: provider.model,
    inputTokens: json.usage?.input_tokens,
    outputTokens: json.usage?.output_tokens,
  };
}

export async function callOpenAICompatible(
  provider: ResolvedProvider,
  input: GenerateTextInput
): Promise<GenerateTextResult> {
  const content: unknown[] = [{ type: "text", text: input.userPrompt }];
  for (const img of input.images ?? []) {
    content.push({ type: "image_url", image_url: { url: `data:${img.mimeType};base64,${img.data}` } });
  }

  const messages = [
    ...(input.systemPrompt ? [{ role: "system", content: input.systemPrompt }] : []),
    { role: "user", content },
  ];

  const res = await fetch(`${provider.base_url}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${provider.api_key}`,
    },
    body: JSON.stringify({ model: provider.model, messages }),
  });

  if (!res.ok) {
    throw new Error(`${provider.name}: ${res.status} ${await res.text()}`);
  }

  const json = await res.json();
  const text = json.choices?.[0]?.message?.content;
  if (!text) throw new Error(`${provider.name}: no text content in response`);

  return {
    text,
    providerName: provider.name,
    model: provider.model,
    inputTokens: json.usage?.prompt_tokens,
    outputTokens: json.usage?.completion_tokens,
  };
}

function callerFor(providerType: ProviderType): HopCaller {
  switch (providerType) {
    case "gemini":
      return callGemini;
    case "anthropic":
      return callAnthropic;
    case "openai_compatible":
      return callOpenAICompatible;
  }
}

/** Walks the chain in order; a hop's failure is logged (when userId is given)
 *  and dispatch moves to the next hop. Only throws once every hop has
 *  failed. Exported (rather than folded into generateText) so the self-check
 *  can inject a fake `resolveCaller` and exercise the fallback logic without
 *  any real network calls. */
export async function runChain(
  chain: ResolvedProvider[],
  input: GenerateTextInput,
  logContext: { userId?: string; action: string; metadata?: Record<string, unknown> },
  resolveCaller: (providerType: ProviderType) => HopCaller
): Promise<GenerateTextResult> {
  if (chain.length === 0) {
    throw new Error("No AI provider configured for this task and no GEMINI_API_KEY fallback available.");
  }

  const errors: string[] = [];
  for (const provider of chain) {
    const startedAt = Date.now();
    try {
      const result = await resolveCaller(provider.provider_type)(provider, input);
      if (logContext.userId) {
        await logAiUsage({
          userId: logContext.userId,
          action: logContext.action,
          model: `${provider.name}/${result.model}`,
          inputTokens: result.inputTokens ?? 0,
          outputTokens: result.outputTokens ?? 0,
          durationMs: Date.now() - startedAt,
          metadata: logContext.metadata,
        });
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${provider.name}: ${message}`);
      if (logContext.userId) {
        await logAiUsage({
          userId: logContext.userId,
          action: logContext.action,
          model: `${provider.name}/${provider.model}`,
          durationMs: Date.now() - startedAt,
          status: "error",
          error: message,
          metadata: logContext.metadata,
        });
      }
    }
  }

  throw new Error(`All providers failed: ${errors.join("; ")}`);
}

export async function generateText(
  chain: ResolvedProvider[],
  input: GenerateTextInput,
  logContext: { userId?: string; action: string; metadata?: Record<string, unknown> }
): Promise<GenerateTextResult> {
  return runChain(chain, input, logContext, callerFor);
}

/** SSE stream for the two streaming routes. Only chain[0] is used — see the
 *  "no mid-stream fallback" global constraint. Gemini streams token-by-token
 *  via generateContentStream; Anthropic/OpenAI-compatible providers are
 *  called non-streaming and flushed as a single SSE chunk.
 *  ponytail: real incremental streaming for those two needs vendor-specific
 *  SSE parsing per type — add it if latency-to-first-token matters. */
export async function generateTextStream(
  chain: ResolvedProvider[],
  input: GenerateTextInput,
  logContext: { userId?: string; action: string; metadata?: Record<string, unknown> }
): Promise<ReadableStream<Uint8Array>> {
  const provider = chain[0];
  if (!provider) {
    throw new Error("No AI provider configured for this task and no GEMINI_API_KEY fallback available.");
  }

  const encoder = new TextEncoder();
  const startedAt = Date.now();

  if (provider.provider_type === "gemini") {
    const ai = new GoogleGenAI({ apiKey: provider.api_key });
    const prompt = [input.systemPrompt, input.userPrompt].filter(Boolean).join("\n\n");
    const response = await ai.models.generateContentStream({ model: provider.model, contents: prompt });

    let usageCaptured = false;
    return new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of response) {
            const text = chunk.text;
            if (text) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`)
              );
            }
            const usage = chunk.usageMetadata;
            if (usage && !usageCaptured && logContext.userId) {
              usageCaptured = true;
              await logAiUsage({
                userId: logContext.userId,
                action: logContext.action,
                model: `${provider.name}/${provider.model}`,
                inputTokens: usage.promptTokenCount ?? 0,
                outputTokens: usage.candidatesTokenCount ?? 0,
                durationMs: Date.now() - startedAt,
                metadata: logContext.metadata,
              });
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        } finally {
          controller.close();
          if (!usageCaptured && logContext.userId) {
            await logAiUsage({
              userId: logContext.userId,
              action: logContext.action,
              model: `${provider.name}/${provider.model}`,
              durationMs: Date.now() - startedAt,
              metadata: logContext.metadata,
            });
          }
        }
      },
    });
  }

  return new ReadableStream({
    async start(controller) {
      try {
        const result = await callerFor(provider.provider_type)(provider, input);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: result.text } }] })}\n\n`)
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        if (logContext.userId) {
          await logAiUsage({
            userId: logContext.userId,
            action: logContext.action,
            model: `${provider.name}/${result.model}`,
            inputTokens: result.inputTokens ?? 0,
            outputTokens: result.outputTokens ?? 0,
            durationMs: Date.now() - startedAt,
            metadata: logContext.metadata,
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`));
        if (logContext.userId) {
          await logAiUsage({
            userId: logContext.userId,
            action: logContext.action,
            model: `${provider.name}/${provider.model}`,
            durationMs: Date.now() - startedAt,
            status: "error",
            error: message,
            metadata: logContext.metadata,
          });
        }
      } finally {
        controller.close();
      }
    },
  });
}

/** Scraping-task substitute for Gemini's built-in url_context tool: plain
 *  fetch + tag-stripping, used only when the resolved scraping hop isn't
 *  Gemini. Capped at 20k chars — plenty for a job posting, keeps the prompt
 *  bounded. */
export async function fetchUrlAsText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; AtTrack/1.0)" },
  });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return stripHtml(await res.text());
}

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 20000);
}

export type { HopCaller };
```

- [ ] **Step 2: Write `lib/ai/providers.selfcheck.ts`**

```ts
/**
 * Self-check for the AI provider dispatch engine — pure logic only: fallback
 * chain ordering/error handling (via a fake resolveCaller, no real provider
 * APIs are called) and HTML stripping. No test framework — plain asserts,
 * matching lib/db/selfcheck.ts's established convention.
 *
 * Run with: node lib/ai/providers.selfcheck.ts
 */
import assert from "node:assert/strict";
import { runChain, stripHtml, type ResolvedProvider, type GenerateTextResult, type HopCaller } from "./providers.ts";

let passed = 0;
function ok(label: string) {
  passed++;
  console.log(`  ok  ${label}`);
}

function provider(id: string): ResolvedProvider {
  return {
    id,
    name: id,
    provider_type: "openai_compatible",
    base_url: "https://example.test",
    model: "test-model",
    api_key: "x",
  };
}

const noLog = { action: "selfcheck" }; // no userId -> runChain never touches the DB

// ---------- first hop succeeds: no fallback attempted ----------
{
  const calls: string[] = [];
  const fakeCaller: HopCaller = async (p): Promise<GenerateTextResult> => {
    calls.push(p.id);
    return { text: `from ${p.id}`, providerName: p.name, model: p.model };
  };

  const result = await runChain([provider("a"), provider("b")], { userPrompt: "hi" }, noLog, () => fakeCaller);
  assert.equal(result.text, "from a");
  assert.deepEqual(calls, ["a"]);
  ok("first hop success short-circuits the chain");
}

// ---------- first hop fails, second succeeds ----------
{
  const calls: string[] = [];
  const fakeCaller: HopCaller = async (p): Promise<GenerateTextResult> => {
    calls.push(p.id);
    if (p.id === "a") throw new Error("boom");
    return { text: `from ${p.id}`, providerName: p.name, model: p.model };
  };

  const result = await runChain([provider("a"), provider("b")], { userPrompt: "hi" }, noLog, () => fakeCaller);
  assert.equal(result.text, "from b");
  assert.deepEqual(calls, ["a", "b"]);
  ok("first-hop failure falls through to the second hop");
}

// ---------- every hop fails ----------
{
  const fakeCaller: HopCaller = async () => {
    throw new Error("nope");
  };

  await assert.rejects(
    () => runChain([provider("a"), provider("b")], { userPrompt: "hi" }, noLog, () => fakeCaller),
    /All providers failed: a: nope; b: nope/
  );
  ok("exhausted chain throws a combined error");
}

// ---------- empty chain ----------
{
  await assert.rejects(
    () => runChain([], { userPrompt: "hi" }, noLog, () => (async () => ({ text: "", providerName: "", model: "" })) as HopCaller),
    /No AI provider configured/
  );
  ok("empty chain throws immediately");
}

// ---------- stripHtml ----------
{
  const html = "<html><head><style>.a{color:red}</style></head><body><script>evil()</script><p>Hello&nbsp;World</p></body></html>";
  assert.equal(stripHtml(html), "Hello World");
  ok("stripHtml removes script/style/tags and collapses whitespace");
}

console.log(`\n${passed} checks passed.`);
```

- [ ] **Step 3: Run the self-check**

Run: `node lib/ai/providers.selfcheck.ts`
Expected: 5 `ok` lines, then `5 checks passed.`, exit 0.

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors from `lib/ai/providers.ts`.

- [ ] **Step 5: Commit**

```bash
git add lib/ai/providers.ts lib/ai/providers.selfcheck.ts
git commit -m "feat(ai-providers): add provider dispatch engine with fallback chain

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Rewire `extractJob` (scraping task)

**Files:**
- Modify: `lib/ai/ai.ts` (full rewrite of the file)

**Interfaces:**
- Consumes: `resolveProviderChain`, `generateText`, `fetchUrlAsText`, `type ResolvedProvider` from `@/lib/ai/providers` (Task 3).
- Produces: `extractJob(imagesBase64: string[], text: string, url: string, userId?: string): Promise<ExtractionResult>` — unchanged signature, so `lib/actions/job-imports.ts:106` (the only caller) needs no change.

- [ ] **Step 1: Replace `lib/ai/ai.ts`**

```ts
import { extractionSchema, type ExtractionResult } from "./schema";
import { EXTRACTION_PROMPT } from "./prompts";
import { logAiUsage } from "@/lib/actions/ai-usage";
import { GoogleGenAI } from "@google/genai";
import { resolveProviderChain, generateText, fetchUrlAsText, type ResolvedProvider } from "./providers";

type ImagePart = { type: "image"; mime_type: string; data: string };
type TextPart = { type: "text"; text: string };

function parseExtraction(responseText: string): ExtractionResult {
  const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || responseText.match(/(\{[\s\S]*\})/);
  if (!jsonMatch) throw new Error("Failed to extract JSON from model response");

  const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
  const validated = extractionSchema.safeParse(parsed);
  if (!validated.success) throw new Error(`Invalid extraction result: ${validated.error.message}`);
  return validated.data;
}

/** Gemini hop: native interactions API + url_context tool — this is the
 *  exact behavior extractJob had before providers existed. Every other
 *  provider type can't fetch a URL itself, so extractJob pre-fetches it once
 *  (see fetchUrlAsText below) and folds the text into the prompt instead. */
async function extractViaGemini(
  provider: ResolvedProvider,
  imagesBase64: string[],
  promptText: string,
  hasUrl: boolean
): Promise<{
  result: ExtractionResult;
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
  reasoningTokens?: number;
}> {
  const ai = new GoogleGenAI({ apiKey: provider.api_key });
  const input: Array<ImagePart | TextPart> = [
    ...imagesBase64.map((data): ImagePart => ({ type: "image", mime_type: "image/png", data })),
    { type: "text", text: promptText },
  ];

  const interaction = await ai.interactions.create({
    model: provider.model,
    input,
    tools: hasUrl ? [{ type: "url_context" }] : undefined,
    generation_config: { max_output_tokens: 8192, thinking_level: "low" },
  });

  const responseText =
    interaction.output_text ||
    interaction.steps
      ?.flatMap((step) => ("content" in step ? step.content ?? [] : []))
      .filter((c): c is { type: "text"; text: string } => c.type === "text")
      .map((c) => c.text)
      .join("");

  if (!responseText) throw new Error("No text content in response");

  const usage = interaction.usage;
  return {
    result: parseExtraction(responseText),
    inputTokens: usage?.total_input_tokens ?? 0,
    outputTokens: usage?.total_output_tokens ?? 0,
    cachedTokens: usage?.total_cached_tokens,
    reasoningTokens: usage?.total_thought_tokens,
  };
}

/**
 * One job posting, extracted from any mix of screenshots, pasted text, and a
 * source URL (career page, LinkedIn post, Facebook post, ...) — at least one
 * of the three must be provided. All sources go into the same call so the
 * model merges them itself instead of us running separate extractions and
 * reconciling the results in code.
 *
 * Resolves the user's "scraping" provider chain and tries each hop in order.
 * A Gemini hop uses its native url_context tool to fetch the URL; any other
 * hop gets the URL's text content pre-fetched and folded into the prompt.
 */
export async function extractJob(
  imagesBase64: string[],
  text: string,
  url: string,
  userId?: string
): Promise<ExtractionResult> {
  const trimmedText = text.trim();
  const trimmedUrl = url.trim();
  if (imagesBase64.length === 0 && !trimmedText && !trimmedUrl) {
    throw new Error("Provide a screenshot, pasted text, a link, or a combination");
  }

  const startedAt = Date.now();
  const metadata = { screenshots: imagesBase64.length, hasText: !!trimmedText, hasUrl: !!trimmedUrl };

  const chain = userId ? await resolveProviderChain(userId, "scraping") : [];
  if (chain.length === 0) {
    const message = "No AI provider configured for scraping and no GEMINI_API_KEY fallback available.";
    if (userId) {
      await logAiUsage({ userId, action: "extract_job", durationMs: Date.now() - startedAt, status: "error", error: message, metadata });
    }
    throw new Error(message);
  }

  let prefetchedUrlText = "";
  if (trimmedUrl && chain.some((p) => p.provider_type !== "gemini")) {
    try {
      prefetchedUrlText = await fetchUrlAsText(trimmedUrl);
    } catch {
      prefetchedUrlText = ""; // best-effort: fall through with whatever other sources were given
    }
  }

  const buildPrompt = (includeUrlFetchTool: boolean, includePrefetchedText: boolean) =>
    EXTRACTION_PROMPT +
    (imagesBase64.length > 1
      ? "\n\nNote: multiple screenshots of the same job posting are provided — analyze them together."
      : "") +
    (trimmedUrl && includeUrlFetchTool
      ? `\n\nJob posting URL: ${trimmedUrl}\nFetch this page with the url_context tool and use it as a source.`
      : "") +
    (trimmedText ? "\n\nPasted job posting text:\n" + trimmedText : "") +
    (includePrefetchedText && prefetchedUrlText ? "\n\nFetched job posting page content:\n" + prefetchedUrlText : "") +
    (trimmedUrl && trimmedText
      ? "\n\nNote: the pasted text and the URL may describe the same posting with different levels of detail (e.g. a shorter social-media blurb vs. the fuller career-page listing) — merge them into one complete result rather than preferring one over the other."
      : "");

  const errors: string[] = [];
  for (const provider of chain) {
    try {
      if (provider.provider_type === "gemini") {
        const promptText = buildPrompt(true, false);
        const { result, inputTokens, outputTokens, cachedTokens, reasoningTokens } = await extractViaGemini(
          provider,
          imagesBase64,
          promptText,
          !!trimmedUrl
        );
        if (userId) {
          await logAiUsage({
            userId,
            action: "extract_job",
            model: `${provider.name}/${provider.model}`,
            inputTokens,
            outputTokens,
            cachedTokens,
            reasoningTokens,
            durationMs: Date.now() - startedAt,
            metadata,
          });
        }
        return result;
      }

      const promptText = buildPrompt(false, true);
      const images = imagesBase64.map((data) => ({ mimeType: "image/png", data }));
      const generated = await generateText([provider], { userPrompt: promptText, images }, {
        userId,
        action: "extract_job",
        metadata,
      });
      return parseExtraction(generated.text);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${provider.name}: ${message}`);
      // Non-gemini hop failures are already logged inside generateText/runChain;
      // this covers the gemini branch, which bypasses that shared path.
      if (userId && provider.provider_type === "gemini") {
        await logAiUsage({
          userId,
          action: "extract_job",
          model: `${provider.name}/${provider.model}`,
          durationMs: Date.now() - startedAt,
          status: "error",
          error: message,
          metadata,
        });
      }
    }
  }

  const message = `All providers failed: ${errors.join("; ")}`;
  if (userId) {
    await logAiUsage({ userId, action: "extract_job", durationMs: Date.now() - startedAt, status: "error", error: message, metadata });
  }
  throw new Error(message);
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors from `lib/ai/ai.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/ai/ai.ts
git commit -m "feat(ai-providers): rewire extractJob through the scraping provider chain

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Rewire resume matching + MCQ generation (text task)

**Files:**
- Modify: `lib/ai/resume.ts` (replace the Gemini-calling parts of `extractResumeContent` and `calculateMatchScore`; schemas and `parseJsonResponse` stay as-is)
- Modify: `lib/ai/mcq.ts` (replace the Gemini-calling part of `generateMCQQuestions`)

**Interfaces:**
- Consumes: `resolveProviderChain`, `generateText` from `@/lib/ai/providers` (Task 3).
- Produces: `extractResumeContent(pdfText, userId?)`, `calculateMatchScore(jobTitle, jobDescription, resumeMatchData, userId?)`, `generateMCQQuestions(params)` — signatures unchanged, so callers in `lib/actions/documents.ts`, `lib/actions/jobs.ts`, `lib/actions/mcq.ts` need no changes.

- [ ] **Step 1: Rewrite `lib/ai/resume.ts`**

Replace the top imports and both exported functions; keep `resumeMatchDataSchema`, `ResumeMatchData`, `matchScoreSchema`, `MatchScore`, and `parseJsonResponse` exactly as they are today (lines 1–67 of the current file — do not change them).

```ts
import { z } from "zod";
import { logAiUsage } from "@/lib/actions/ai-usage";
import { resolveProviderChain, generateText } from "./providers";

export const resumeMatchDataSchema = z.object({
  skills: z.array(z.string()),
  experience: z.array(
    z.union([
      z.string(),
      z.object({
        company: z.string().optional(),
        role: z.string().optional(),
        title: z.string().optional(),
        duration: z.string().optional(),
        description: z.string().optional(),
      }).passthrough(),
    ])
  ).transform((items) =>
    items.map((item) =>
      typeof item === "string"
        ? item
        : [item.role || item.title, item.company, item.duration]
            .filter(Boolean)
            .join(" at ") || item.description || JSON.stringify(item)
    )
  ),
  education: z.array(
    z.union([
      z.string(),
      z.object({
        school: z.string().optional(),
        institution: z.string().optional(),
        degree: z.string().optional(),
        field: z.string().optional(),
        duration: z.string().optional(),
      }).passthrough(),
    ])
  ).transform((items) =>
    items.map((item) =>
      typeof item === "string"
        ? item
        : [item.degree, item.field, item.school || item.institution, item.duration]
            .filter(Boolean)
            .join(" — ") || JSON.stringify(item)
    )
  ),
  summary: z.string(),
});

export type ResumeMatchData = z.infer<typeof resumeMatchDataSchema>;

export const matchScoreSchema = z.object({
  score: z.number().min(0).max(100),
  reasoning: z.string(),
});

export type MatchScore = z.infer<typeof matchScoreSchema>;

function parseJsonResponse(text: string): unknown {
  const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/(\{[\s\S]*\})/);
  if (!jsonMatch) {
    throw new Error("Failed to extract JSON from model response");
  }
  return JSON.parse(jsonMatch[1] || jsonMatch[0]);
}

export async function extractResumeContent(pdfText: string, userId?: string): Promise<ResumeMatchData> {
  const startedAt = Date.now();
  const prompt = `Extract structured information from this resume text. Return JSON with:
- skills: array of strings (technical and soft skills mentioned)
- experience: array of strings describing each role (e.g. "Software Engineer at Google, 2020-2023")
- education: array of strings describing each entry (e.g. "BS Computer Science — MIT, 2016-2020")
- summary: 2-3 sentence professional summary

IMPORTANT: All array items must be plain strings, not objects.

Resume text:
${pdfText.slice(0, 8000)}`;

  const chain = userId ? await resolveProviderChain(userId, "text") : [];
  if (chain.length === 0) {
    const message = "No AI provider configured for text and no GEMINI_API_KEY fallback available.";
    if (userId) {
      await logAiUsage({ userId, action: "extract_resume", durationMs: Date.now() - startedAt, status: "error", error: message });
    }
    throw new Error(message);
  }

  const generated = await generateText(chain, { userPrompt: prompt }, { userId, action: "extract_resume" });

  const parsed = parseJsonResponse(generated.text);
  const validated = resumeMatchDataSchema.safeParse(parsed);

  if (!validated.success) {
    if (userId) {
      await logAiUsage({
        userId,
        action: "extract_resume",
        durationMs: Date.now() - startedAt,
        status: "error",
        error: `Invalid resume extraction: ${validated.error.message}`,
      });
    }
    console.error("[ResumeExtract] Validation error:", validated.error.flatten());
    throw new Error(`Invalid resume extraction: ${validated.error.message}`);
  }

  return validated.data;
}

export async function calculateMatchScore(
  jobTitle: string,
  jobDescription: string | null,
  resumeMatchData: ResumeMatchData,
  userId?: string
): Promise<MatchScore> {
  const startedAt = Date.now();
  const jobContext = [jobTitle, jobDescription].filter(Boolean).join("\n");

  const resumeContext = [
    `Skills: ${resumeMatchData.skills.join(", ")}`,
    `Experience: ${resumeMatchData.experience.join("; ")}`,
    `Education: ${resumeMatchData.education.join("; ")}`,
    `Summary: ${resumeMatchData.summary}`,
  ].join("\n");

  const prompt = `You are a job-match analyst. Compare this job posting against this candidate's resume and give a match score from 0-100.

Consider:
- Skills alignment (most important)
- Experience relevance
- Education match
- Overall fit

Job:
${jobContext}

Candidate Resume:
${resumeContext}

Return JSON: { "score": <number 0-100>, "reasoning": "<1-2 sentence explanation>" }`;

  const chain = userId ? await resolveProviderChain(userId, "text") : [];
  if (chain.length === 0) {
    const message = "No AI provider configured for text and no GEMINI_API_KEY fallback available.";
    if (userId) {
      await logAiUsage({ userId, action: "match_score", durationMs: Date.now() - startedAt, status: "error", error: message, metadata: { job_title: jobTitle } });
    }
    throw new Error(message);
  }

  const generated = await generateText(chain, { userPrompt: prompt }, { userId, action: "match_score", metadata: { job_title: jobTitle } });

  const parsed = parseJsonResponse(generated.text);
  const validated = matchScoreSchema.safeParse(parsed);

  if (!validated.success) {
    if (userId) {
      await logAiUsage({
        userId,
        action: "match_score",
        durationMs: Date.now() - startedAt,
        status: "error",
        error: `Invalid match score: ${validated.error.message}`,
        metadata: { job_title: jobTitle },
      });
    }
    throw new Error(`Invalid match score: ${validated.error.message}`);
  }

  return validated.data;
}
```

- [ ] **Step 2: Rewrite `lib/ai/mcq.ts`**

Keep the `MCQ_PROMPT` constant exactly as-is. Replace the imports and the body of `generateMCQQuestions`:

```ts
import type { MCQQuestion } from "@/lib/types/mcq";
import { logAiUsage } from "@/lib/actions/ai-usage";
import { resolveProviderChain, generateText } from "./providers";

const MCQ_PROMPT = `You are an interview preparation assistant. Generate multiple-choice questions (MCQs) to help a candidate prepare for a job interview.

Rules:
- Generate exactly 12 questions
- Each question must have exactly 4 options (A, B, C, D)
- Questions should cover: technical skills, problem-solving, behavioral scenarios, and role-specific knowledge
- Mark the correct answer index (0-3)
- Provide a brief explanation for each answer
- Questions should be relevant to the job title and description
- Mix difficulty levels: easy (3-4), medium (4-5), hard (3-4)

Return a JSON array of objects with these fields:
[
  {
    "question": "string",
    "options": ["A", "B", "C", "D"],
    "correctIndex": 0,
    "explanation": "string"
  }
]

Return ONLY the JSON array, no other text.`;

export async function generateMCQQuestions(params: {
  jobTitle: string;
  description: string | null;
  employmentType: string | null;
  notes: Array<{ title: string; bullets: string[] }> | null;
  userId?: string;
}): Promise<MCQQuestion[]> {
  const startedAt = Date.now();
  const context = [
    `Job Title: ${params.jobTitle}`,
    params.employmentType ? `Employment Type: ${params.employmentType}` : null,
    params.description ? `Job Description:\n${params.description}` : null,
    params.notes
      ? `Skills & Requirements:\n${params.notes.map((n) => `${n.title}: ${n.bullets.join(", ")}`).join("\n")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const prompt = `${MCQ_PROMPT}\n\n---\n\nJob Context:\n${context}`;

  const chain = params.userId ? await resolveProviderChain(params.userId, "text") : [];
  if (chain.length === 0) {
    const message = "No AI provider configured for text and no GEMINI_API_KEY fallback available.";
    if (params.userId) {
      await logAiUsage({
        userId: params.userId,
        action: "generate_mcq",
        durationMs: Date.now() - startedAt,
        status: "error",
        error: message,
        metadata: { job_title: params.jobTitle },
      });
    }
    throw new Error(message);
  }

  const generated = await generateText(chain, { userPrompt: prompt }, {
    userId: params.userId,
    action: "generate_mcq",
    metadata: { job_title: params.jobTitle },
  });

  const jsonMatch = generated.text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    if (params.userId) {
      await logAiUsage({
        userId: params.userId,
        action: "generate_mcq",
        durationMs: Date.now() - startedAt,
        status: "error",
        error: "Failed to extract JSON from model response",
        metadata: { job_title: params.jobTitle },
      });
    }
    throw new Error("Failed to extract JSON from model response");
  }

  const parsed = JSON.parse(jsonMatch[0]);

  if (!Array.isArray(parsed) || parsed.length === 0) {
    if (params.userId) {
      await logAiUsage({
        userId: params.userId,
        action: "generate_mcq",
        durationMs: Date.now() - startedAt,
        status: "error",
        error: "Invalid response format",
        metadata: { job_title: params.jobTitle },
      });
    }
    throw new Error("Invalid response format");
  }

  return parsed.map((q: MCQQuestion, i: number) => ({
    id: `q-${i}`,
    question: q.question,
    options: q.options,
    correctIndex: q.correctIndex,
    explanation: q.explanation,
  }));
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors from `lib/ai/resume.ts` or `lib/ai/mcq.ts`.

- [ ] **Step 4: Commit**

```bash
git add lib/ai/resume.ts lib/ai/mcq.ts
git commit -m "feat(ai-providers): rewire resume matching and MCQ generation through the text provider chain

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Rewire the two streaming routes (text task)

**Files:**
- Modify: `app/api/ai/generate-email/route.ts` (full rewrite)
- Modify: `app/api/ai/generate-ai-tool/route.ts` (full rewrite)

**Interfaces:**
- Consumes: `resolveProviderChain`, `generateTextStream` from `@/lib/ai/providers` (Task 3).
- Produces: unchanged `POST` handler behavior/response shape for both routes — `lib/ai/email.ts`'s `streamGenerateEmail` and `lib/ai/ai-tools.ts`'s `streamGenerateAiTool` (the client-side SSE readers) need no changes, since the SSE chunk shape (`{choices:[{delta:{content}}]}` ... `[DONE]`) is unchanged.

- [ ] **Step 1: Rewrite `app/api/ai/generate-email/route.ts`**

```ts
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveProviderChain, generateTextStream } from "@/lib/ai/providers";

const EMAIL_SYSTEM_PROMPT = `You are a professional job application email writer. Write a compelling, personalized application email that will stand out while avoiding spam filters.

STRICT RULES FOR SPAM AVOIDANCE:
- Use PLAIN TEXT formatting only, no HTML
- Write in a natural, conversational professional tone
- NEVER use spam trigger words: "guarantee", "amazing", "incredible", "urgent", "limited time", "act now", "free", "winner", "congratulations", "exclusive deal", "no obligation", "risk free"
- NEVER use ALL CAPS for emphasis
- NEVER use excessive exclamation marks (max 1 per email)
- Use proper sentence structure with varied sentence lengths
- Include specific details from the job posting to show genuine interest
- Keep subject line under 60 characters, no ALL CAPS, no spammy punctuation (!!!, ???)
- Personalize greetings and references to the company
- Use standard professional email structure
- Keep the email between 150-300 words
- Include a clear call to action without being pushy
- Reference specific skills/experiences that match the job requirements

OUTPUT FORMAT:
Return ONLY a JSON object with this exact structure, no markdown, no code blocks:
{"subject": "your subject line here", "body": "your email body here"}

The body should use \\n for line breaks. Do not wrap in quotes.`;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await req.json();
  const { jobTitle, companyName, jobDescription, applicationProcess, applicantName, applicantHeadline, resumeContent } = body;

  const resumeSection = resumeContent ? `\n\nAPPLICANT'S RESUME/EXPERIENCE:\n${resumeContent}` : "";
  const processSection = applicationProcess ? `\n\nAPPLICATION PROCESS NOTES: ${applicationProcess}` : "";

  const userPrompt = `Write a job application email for:

POSITION: ${jobTitle}
COMPANY: ${companyName}
${jobDescription ? `JOB DESCRIPTION:\n${jobDescription}` : "No description provided."}
${processSection}

APPLICANT: ${applicantName}${applicantHeadline ? `, ${applicantHeadline}` : ""}
${resumeSection}

The applicant's resume will be attached to this email. Write a personalized, professional email that references relevant experience from the resume. Do NOT include "Please find my resume attached" or similar phrases — just write a strong email. Return ONLY the JSON object with "subject" and "body" fields.`;

  const chain = await resolveProviderChain(user.id, "text");
  if (chain.length === 0) {
    return new Response(
      JSON.stringify({ error: "No AI provider configured and no GEMINI_API_KEY fallback available." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const stream = await generateTextStream(
    chain,
    { systemPrompt: EMAIL_SYSTEM_PROMPT, userPrompt },
    { userId: user.id, action: "generate_email", metadata: { job_title: jobTitle, company_name: companyName } }
  );

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 2: Rewrite `app/api/ai/generate-ai-tool/route.ts`**

Keep `SPAM_RULES` and `PURPOSE` exactly as they are today. Replace the imports and the body of `POST`:

```ts
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { AiToolKind } from "@/lib/types/ai-tools";
import { resolveProviderChain, generateTextStream } from "@/lib/ai/providers";

// Shared across all 8 kinds — only the purpose paragraph below changes.
const SPAM_RULES = `STRICT RULES FOR SPAM AVOIDANCE:
- Use PLAIN TEXT formatting only, no HTML
- Write in a natural, conversational professional tone
- NEVER use spam trigger words: "guarantee", "amazing", "incredible", "urgent", "limited time", "act now", "free", "winner", "congratulations", "exclusive deal", "no obligation", "risk free"
- NEVER use ALL CAPS for emphasis
- NEVER use excessive exclamation marks (max 1 per email)
- Use proper sentence structure with varied sentence lengths
- Keep subject line under 60 characters, no ALL CAPS, no spammy punctuation (!!!, ???)
- Personalize greetings and references to the company
- Use standard professional email structure
- Keep the email between 100-300 words

OUTPUT FORMAT:
Return ONLY a JSON object with this exact structure, no markdown, no code blocks:
{"subject": "your subject line here", "body": "your email body here"}

The body should use \\n for line breaks. Do not wrap in quotes.`;

const PURPOSE: Record<AiToolKind, string> = {
  cover_letter:
    "You are writing a cover-letter-style application email. Reference specific skills/experience from the resume that match the job requirements, and show genuine interest in the role and company.",
  follow_up_application:
    "You are writing a polite follow-up email sent after submitting an application, checking on its status without being pushy. Reference the role and the date applied if given.",
  reschedule_interview:
    "You are writing an email asking to reschedule a previously confirmed interview. Be apologetic but professional, propose flexibility on timing, and don't over-explain the reason.",
  follow_up_interview:
    "You are writing a thank-you / follow-up email sent after an interview. Thank the interviewer, reference something specific from the conversation if given, and reaffirm interest in the role.",
  offer_negotiation:
    "You are writing an email negotiating the terms of a job offer (salary, start date, benefits, etc). Be confident, gracious, and specific about what is being asked for, without sounding demanding.",
  offer_acceptance:
    "You are writing an email formally accepting a job offer. Be warm and enthusiastic, confirm key terms if given, and ask about next steps.",
  offer_decline:
    "You are writing an email formally declining a job offer. Be gracious and appreciative, keep the door open for the future, and do not over-explain the reason.",
  offer_time_extension:
    "You are writing an email requesting more time to consider a job offer before responding. Be respectful of the employer's timeline and give a reasonable new date.",
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await req.json();
  const {
    kind,
    jobTitle,
    companyName,
    jobDescription,
    applicantName,
    applicantHeadline,
    resumeContent,
    context,
  }: {
    kind: AiToolKind;
    jobTitle: string;
    companyName: string;
    jobDescription: string | null;
    applicantName: string;
    applicantHeadline: string | null;
    resumeContent: string | null;
    context: string | null;
  } = body;

  const purpose = PURPOSE[kind];
  if (!purpose) {
    return new Response(JSON.stringify({ error: `Unknown AI Tools kind: ${kind}` }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const systemPrompt = `${purpose}\n\n${SPAM_RULES}`;

  const userPrompt = `POSITION: ${jobTitle}
COMPANY: ${companyName}
${jobDescription ? `JOB DESCRIPTION:\n${jobDescription}` : "No description provided."}
${context ? `\nADDITIONAL CONTEXT:\n${context}` : ""}

APPLICANT: ${applicantName}${applicantHeadline ? `, ${applicantHeadline}` : ""}
${resumeContent ? `\nAPPLICANT'S RESUME/EXPERIENCE:\n${resumeContent}` : ""}

Return ONLY the JSON object with "subject" and "body" fields.`;

  const chain = await resolveProviderChain(user.id, "text");
  if (chain.length === 0) {
    return new Response(
      JSON.stringify({ error: "No AI provider configured and no GEMINI_API_KEY fallback available." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const stream = await generateTextStream(
    chain,
    { systemPrompt, userPrompt },
    { userId: user.id, action: "generate_ai_tool", metadata: { kind, job_title: jobTitle, company_name: companyName } }
  );

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors from either route file.

- [ ] **Step 4: Commit**

```bash
git add app/api/ai/generate-email/route.ts app/api/ai/generate-ai-tool/route.ts
git commit -m "feat(ai-providers): rewire email and AI Tools streaming through the text provider chain

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Settings UI

**Files:**
- Create: `components/settings/ai-provider-dialog.tsx`
- Create: `components/settings/ai-task-route-picker.tsx`
- Create: `components/settings/ai-providers-settings.tsx`
- Modify: `app/(dashboard)/settings/page.tsx`

**Interfaces:**
- Consumes: `listProviders`, `createProvider`, `updateProvider`, `deleteProvider`, `getTaskRoutes`, `saveTaskRoute` from `@/lib/actions/ai-providers` (Task 2); `PROVIDER_TYPES`, `PROVIDER_TYPE_LABELS`, `TASK_TYPE_LABELS`, `OPENAI_COMPATIBLE_PRESETS`, `type AiProviderSummary`, `type ProviderType`, `type TaskType` from `@/lib/types/ai-providers` (Task 1); existing `Badge`, `Input`, `Label`, `Select`/`SelectContent`/`SelectItem`/`SelectTrigger`/`SelectValue`, `Spinner` from `@/components/ui/*`.
- Produces: `<AiProvidersSettings initialProviders={...} initialRoutes={...} />` — the single export `page.tsx` renders.

- [ ] **Step 1: Create `components/settings/ai-provider-dialog.tsx`**

```tsx
"use client";

import { useState } from "react";
import { createProvider, updateProvider } from "@/lib/actions/ai-providers";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X } from "lucide-react";
import { toast } from "sonner";
import {
  PROVIDER_TYPES,
  PROVIDER_TYPE_LABELS,
  OPENAI_COMPATIBLE_PRESETS,
  type AiProviderSummary,
  type ProviderType,
} from "@/lib/types/ai-providers";

const MODEL_PLACEHOLDER: Record<ProviderType, string> = {
  gemini: "models/gemini-2.0-flash",
  anthropic: "claude-sonnet-4-20250514",
  openai_compatible: "gpt-4o-mini",
};

interface AiProviderDialogProps {
  provider: AiProviderSummary | null; // null = add mode
  onClose: () => void;
  onSaved: () => void;
}

export function AiProviderDialog({ provider, onClose, onSaved }: AiProviderDialogProps) {
  const [name, setName] = useState(provider?.name ?? "");
  const [providerType, setProviderType] = useState<ProviderType>(provider?.provider_type ?? "gemini");
  const [baseUrl, setBaseUrl] = useState(provider?.base_url ?? "");
  const [model, setModel] = useState(provider?.model ?? "");
  const [apiKey, setApiKey] = useState("");
  const [pending, setPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);

    const result = provider
      ? await updateProvider(provider.id, {
          name,
          provider_type: providerType,
          base_url: baseUrl,
          model,
          api_key: apiKey || undefined,
        })
      : await createProvider({ name, provider_type: providerType, base_url: baseUrl, model, api_key: apiKey });

    if (result.error) {
      toast.error(result.error);
      setPending(false);
      return;
    }

    toast.success(provider ? "Provider updated." : "Provider added.");
    setPending(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-md max-h-[85vh] overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold">{provider ? "Edit provider" : "Add provider"}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="provider-name">Name</Label>
            <Input
              id="provider-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. My OpenRouter key"
              className="h-10"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="provider-type">Type</Label>
            <Select value={providerType} onValueChange={(v) => setProviderType(v as ProviderType)}>
              <SelectTrigger id="provider-type" className="h-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDER_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {PROVIDER_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {providerType === "openai_compatible" && (
            <div className="space-y-2">
              <Label htmlFor="provider-base-url">Base URL</Label>
              <Input
                id="provider-base-url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.openai.com/v1"
                className="h-10"
                required
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {OPENAI_COMPATIBLE_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setBaseUrl(preset.baseUrl)}
                    className="rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="provider-model">Model</Label>
            <Input
              id="provider-model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={MODEL_PLACEHOLDER[providerType]}
              className="h-10"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="provider-api-key">API key</Label>
            <Input
              id="provider-api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={provider ? "••••••••••••" : "sk-..."}
              className="h-10"
              autoComplete="one-time-code"
              required={!provider}
            />
            {provider && <p className="text-[11px] text-muted-foreground">Leave blank to keep the current key.</p>}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center justify-center rounded-2xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {pending && <Spinner className="mr-2" />}
              {provider ? "Save" : "Add provider"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `components/settings/ai-task-route-picker.tsx`**

```tsx
"use client";

import { useState } from "react";
import { saveTaskRoute } from "@/lib/actions/ai-providers";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowUp, ArrowDown, X } from "lucide-react";
import { toast } from "sonner";
import { TASK_TYPE_LABELS, type AiProviderSummary, type TaskType } from "@/lib/types/ai-providers";

interface AiTaskRoutePickerProps {
  taskType: TaskType;
  description: string;
  allProviders: AiProviderSummary[];
  initialSelectedIds: string[];
}

export function AiTaskRoutePicker({ taskType, description, allProviders, initialSelectedIds }: AiTaskRoutePickerProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);
  const [saving, setSaving] = useState(false);

  const save = async (next: string[]) => {
    setSelectedIds(next);
    setSaving(true);
    const result = await saveTaskRoute(taskType, next);
    if (result.error) toast.error(result.error);
    setSaving(false);
  };

  const availableToAdd = allProviders.filter((p) => !selectedIds.includes(p.id));
  const selected = selectedIds
    .map((id) => allProviders.find((p) => p.id === id))
    .filter((p): p is AiProviderSummary => !!p);

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= selectedIds.length) return;
    const next = [...selectedIds];
    [next[index], next[target]] = [next[target], next[index]];
    save(next);
  };

  return (
    <div className="space-y-2 rounded-2xl border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{TASK_TYPE_LABELS[taskType]}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        {saving && <span className="text-xs text-muted-foreground">Saving…</span>}
      </div>

      {selected.length === 0 ? (
        <p className="text-xs text-muted-foreground">Using default Gemini (from GEMINI_API_KEY).</p>
      ) : (
        <ul className="space-y-1.5">
          {selected.map((p, i) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5"
            >
              <span className="flex items-center gap-2 text-sm">
                <Badge variant="secondary">{i + 1}</Badge>
                {p.name} <span className="text-muted-foreground">({p.model})</span>
              </span>
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                >
                  <ArrowUp className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === selected.length - 1}
                  className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                >
                  <ArrowDown className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => save(selectedIds.filter((id) => id !== p.id))}
                  className="rounded p-1 text-destructive hover:bg-destructive/10"
                >
                  <X className="size-3.5" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {availableToAdd.length > 0 && (
        <Select onValueChange={(id) => save([...selectedIds, id])}>
          <SelectTrigger className="h-9 w-full text-xs">
            <SelectValue placeholder="+ Add provider to this task" />
          </SelectTrigger>
          <SelectContent>
            {availableToAdd.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name} ({p.model})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create `components/settings/ai-providers-settings.tsx`**

```tsx
"use client";

import { useState } from "react";
import { deleteProvider, listProviders } from "@/lib/actions/ai-providers";
import { AiProviderDialog } from "@/components/settings/ai-provider-dialog";
import { AiTaskRoutePicker } from "@/components/settings/ai-task-route-picker";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PROVIDER_TYPE_LABELS, type AiProviderSummary, type TaskType } from "@/lib/types/ai-providers";

interface AiProvidersSettingsProps {
  initialProviders: AiProviderSummary[];
  initialRoutes: Record<TaskType, AiProviderSummary[]>;
}

const TASK_DESCRIPTIONS: Record<TaskType, string> = {
  text: "Resume matching, MCQ generation, email and AI Tools drafting.",
  scraping: "Job-posting extraction, including fetching a source URL.",
  image: "Reserved for a future feature — nothing uses this yet.",
};

export function AiProvidersSettings({ initialProviders, initialRoutes }: AiProvidersSettingsProps) {
  const [providers, setProviders] = useState(initialProviders);
  const [routes, setRoutes] = useState(initialRoutes);
  const [dialogOpen, setDialogOpen] = useState<"add" | AiProviderSummary | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refreshProviders = async () => {
    const next = await listProviders();
    setProviders(next);
    // Routes reference provider ids that still exist; re-derive their display
    // objects from the fresh list so an edited name/model shows up without a
    // full page reload.
    const byId = new Map(next.map((p) => [p.id, p]));
    setRoutes((prev) => {
      const updated = {} as Record<TaskType, AiProviderSummary[]>;
      for (const taskType of Object.keys(prev) as TaskType[]) {
        updated[taskType] = prev[taskType].map((p) => byId.get(p.id)).filter((p): p is AiProviderSummary => !!p);
      }
      return updated;
    });
    setDialogOpen(null);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const result = await deleteProvider(id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Provider deleted.");
      setProviders((prev) => prev.filter((p) => p.id !== id));
      setRoutes((prev) => {
        const updated = {} as Record<TaskType, AiProviderSummary[]>;
        for (const taskType of Object.keys(prev) as TaskType[]) {
          updated[taskType] = prev[taskType].filter((p) => p.id !== id);
        }
        return updated;
      });
    }
    setDeletingId(null);
  };

  // Forces the three pickers to remount (and re-read routes/providers into
  // their own local state) whenever the provider set changes — otherwise a
  // deleted provider would linger in a picker's already-initialized state.
  const providerSetKey = providers.map((p) => p.id).join(",");

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Providers</p>
          <button
            type="button"
            onClick={() => setDialogOpen("add")}
            className="inline-flex items-center gap-1.5 rounded-2xl border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Plus className="size-3.5" />
            Add provider
          </button>
        </div>

        {providers.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No providers configured — using the default Gemini key from GEMINI_API_KEY for everything.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {providers.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 rounded-2xl border border-border px-3 py-2">
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="outline">{PROVIDER_TYPE_LABELS[p.provider_type]}</Badge>
                  <span className="font-medium">{p.name}</span>
                  <span className="text-muted-foreground">{p.model}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setDialogOpen(p)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(p.id)}
                    disabled={deletingId === p.id}
                    className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10 disabled:opacity-50"
                  >
                    {deletingId === p.id ? <Spinner className="size-3.5" /> : <Trash2 className="size-3.5" />}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Task routing</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {(Object.keys(TASK_DESCRIPTIONS) as TaskType[]).map((taskType) => (
            <AiTaskRoutePicker
              key={`${taskType}-${providerSetKey}`}
              taskType={taskType}
              description={TASK_DESCRIPTIONS[taskType]}
              allProviders={providers}
              initialSelectedIds={(routes[taskType] ?? []).map((p) => p.id)}
            />
          ))}
        </div>
      </div>

      {dialogOpen !== null && (
        <AiProviderDialog
          provider={dialogOpen === "add" ? null : dialogOpen}
          onClose={() => setDialogOpen(null)}
          onSaved={refreshProviders}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Wire the card into `app/(dashboard)/settings/page.tsx`**

Add the imports (alongside the existing ones):

```ts
import { listProviders, getTaskRoutes } from "@/lib/actions/ai-providers";
import { AiProvidersSettings } from "@/components/settings/ai-providers-settings";
import { Sparkles } from "lucide-react";
```

(`Mail` is already imported from `lucide-react` — extend that same import line with `Sparkles` rather than adding a second import line.)

Fetch the data alongside the existing `smtpConfig` fetch:

```ts
  const smtpConfig = await getSmtpConfig();
  const [aiProviders, aiTaskRoutes] = await Promise.all([listProviders(), getTaskRoutes()]);
```

Add a new `Card` immediately after the Email (SMTP) card and before the Danger Zone card:

```tsx
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Sparkles className="size-4" />
            AI Providers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AiProvidersSettings initialProviders={aiProviders} initialRoutes={aiTaskRoutes} />
        </CardContent>
      </Card>
```

- [ ] **Step 5: Verify it compiles and lints**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors or warnings.

- [ ] **Step 6: Manual check**

Run: `npm run dev`, open `/settings`. Confirm: the new "AI Providers" card renders with an empty-state message under Providers and "Using default Gemini" under all three task sections; "Add provider" opens the modal; picking "OpenAI-compatible" reveals the Base URL field and preset buttons; saving a provider makes it appear in the list and become selectable in the task pickers; reordering/removing in a picker persists (reload the page and confirm the order survived); deleting a provider removes it from the list and from any task picker it was in.

- [ ] **Step 7: Commit**

```bash
git add components/settings/ai-provider-dialog.tsx components/settings/ai-task-route-picker.tsx components/settings/ai-providers-settings.tsx "app/(dashboard)/settings/page.tsx"
git commit -m "feat(ai-providers): add Settings UI for providers and task routing

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Full-repo verification

**Files:** none (verification only)

- [ ] **Step 1: Full type check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: exit 0, no new warnings.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: production build succeeds.

- [ ] **Step 4: Self-checks**

Run: `node lib/db/selfcheck.ts && node lib/ai/providers.selfcheck.ts`
Expected: both exit 0.

- [ ] **Step 5: Manual smoke test — non-Gemini provider end to end**

In `/settings`, add an `openai_compatible` provider pointed at a real reachable endpoint you have a key for (or Ollama running locally with the OpenAI-compatible route enabled), assign it to Text, and:
- Open a job's AI Tools tab and generate a cover letter — confirm the SSE stream renders the full email (single-chunk flush, per the streaming design) with no console errors.
- Assign the same provider to Scraping, then use "Import with AI" with a job-posting URL (no screenshot/pasted text) — confirm `extractJob` returns a populated result via the `fetchUrlAsText` fallback path, and check `/admin/ai-usage` shows the call logged under that provider's name.

Expected: both flows complete without throwing, and the admin AI-usage log reflects the configured provider rather than "models/gemini-2.0-flash".

- [ ] **Step 6: Update the design spec if reality diverged**

If Step 5 surfaced a deviation from `docs/superpowers/specs/2026-08-09-ai-provider-settings-design.md` (e.g. a provider's API shape needed adjusting), update that file to match what was actually built, and commit it with the rest of this task's fixes.

- [ ] **Step 7: Final commit (only if Steps 5–6 required code changes)**

```bash
git add -A
git commit -m "fix(ai-providers): address issues found in end-to-end verification

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
