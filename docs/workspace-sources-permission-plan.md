# Workspace Sources → Real Permission System + Extensible Connections

**Date:** 2026-08-13 · **Mode:** Architect (discovery + research + plan; NO code yet)
**Supersedes:** the hardcoded `Workspace Sources` drawer (`components/ai-chatbot/workspace-connection-drawer.tsx`) and its fake source list in `lib/ai-chatbot/workspace.ts:deriveWorkspaceSources`.

---

## 1. Discovery — what exists today (evidence)

- **`WorkspaceConnectionDrawer`** (`components/ai-chatbot/workspace-connection-drawer.tsx`) renders a right-side `Sheet` listing `ContextSource[]` with a toggle per source + a "Connect source" button.
- **`deriveWorkspaceSources(snapshot)`** (`lib/ai-chatbot/workspace.ts:83`) is **100% hardcoded**. Only `resume`/`jobs`/`contacts` use real counts from `/api/chat/workspace`; `github`(5 repos), `gdrive`(14), `notion`(9), `linkedin`(1), `email`(27), `projects`(4) have **invented counts + invented `lastSync` strings** ("1 hour ago", "Yesterday"). No GitHub/Notion/LinkedIn/email code exists anywhere.
- **Toggles are decorative.** `handleToggleSource` (`page.tsx:333`) only flips `enabled` in React state. It is never persisted and never reaches the server. `buildWorkspaceContextBlock` consults `enabled` for the 3 real sources only; the **tool layer I built (`lib/ai/tools/*`) does NOT read the toggle at all** — so disabling "GitHub" today changes nothing (and GitHub tool doesn't exist anyway).
- **`ContextSource`** type (`lib/ai-chatbot/types.ts:36`) is `{id,type,name,recordCount,lastSync,enabled}` — no auth/config, no scope, no `sourceId` linking to a tool.
- The tool registry (`lib/ai/tools/registry.ts`) already has `searchJobsTool`/`getResumeTool`/`searchContactsTool`/`searchLinksTool`/`searchAiPromptsTool`/`webSearchTool`, each with a stable `name`. **None are linked to a `ContextSource.id`.** This is the seam to bind permissions.

**Conclusion:** today's drawer is theater (same root cause as the old hardcoded "GitHub" source chip). The fix is to (a) make `enabled` a *real permission* that gates the tool/retrieval layer, (b) replace fake sources with real, auth-backed ones, (c) make "Connect source" actually create new connection scopes.

---

## 2. Research — feasibility of each requested source (honest)

| Source | Verdict | How it becomes real | Free? |
|---|---|---|---|
| **Resumes & CVs** | Keep (real) | Already backed by `documents` table via `getResumes`. Toggle gates `get_resume` tool. | Yes (local) |
| **Job Applications** | Keep (real) | Backed by `jobs` via `getJobsSummary`. Toggle gates `search_jobs`. | Yes (local) |
| **Contacts CRM** | Keep (real) | Backed by `contacts` via `getContactsRetrieved`. Toggle gates `search_contacts`. | Yes (local) |
| **GitHub Repositories** | Needs real auth | GitHub **OAuth App** (recommended) or **PAT**, token stored encrypted (reuse `lib/encryption`). Server calls `GET /user/repos` + contents API. Scope: read-only `repo`. No GitHub code exists → must be built. | Yes (OAuth free tier) |
| **Obsidian Vault** | Replace Notion | Two real options: (1) **Obsidian Local REST API** community plugin → `http://localhost:27123/` + bearer token (free, local, no cloud); (2) server-side **filesystem read** of a configured vault path (atTrack runs locally, so the Next.js server can `fs.readdir` the vault). Option 2 is simplest + fully free. | Yes (both) |
| **LinkedIn Profile** | **Remove** | No legitimate free path: LinkedIn API requires partner-approved OAuth; scraping violates ToS. Per your instruction, drop it. | No |
| **Google Drive / Notion / Email** | **Remove** (not requested) | You did not ask for these; they're fake anyway. Drop from the default list. | — |
| **Database query** | New permission | A toggle that permits a read-only, **schema-bounded** `query_database` tool (whitelisted tables/columns, `user_id`-scoped). NOT arbitrary SQL from the LLM. | Yes (local) |
| **Custom "Connect source"** | New | User-defined `ContextSource` of type `custom`/`api`/`folder` with name + scope description + optional auth fields; stored in `user_sources` table; surfaced as a permission toggle. | Yes |

**Key honesty note:** LinkedIn has no free integration — recommend removal (you agreed). GitHub/Local-REST-Obsidian are real and free. Database-query must be **read-only + allowlisted**, never raw LLM SQL.

---

## 3. Corrected source model

New `ContextSource` (extend `lib/ai-chatbot/types.ts`):
```ts
type SourceKind = "native" | "oauth" | "local-rest" | "fs" | "api" | "custom";
interface ContextSource {
  id: string;                 // stable, e.g. "jobs", "github", "obsidian", "db_query", "custom:<uuid>"
  type: string;               // "resume"|"jobs"|"contacts"|"github"|"obsidian"|"db_query"|"custom"
  name: string;
  kind: SourceKind;
  enabled: boolean;            // REAL permission
  recordCount: number;         // 0 if not yet synced / not applicable
  lastSync: string | null;     // real timestamp or null
  toolName?: string;           // links to a ToolDefinition.name (e.g. "search_jobs")
  auth?: {                     // present when kind needs creds
    status: "none" | "needed" | "connected";
    method?: "oauth" | "pat" | "local-rest" | "fs-path";
    // secrets NEVER live here — only status + a reference; secret in encrypted col
  };
  config?: Record<string, unknown>; // e.g. { vaultPath } / { localRestTokenSet: true }
  isCustom?: boolean;
}
```

Built-in sources (seeded, real):
- `jobs` (native) → tool `search_jobs`
- `resume` (native) → tool `get_resume`
- `contacts` (native) → tool `search_contacts`
- `links` (native, rename "Social Links") → tool `search_links`
- `ai_prompts` (native) → tool `search_ai_prompts`
- `obsidian` (fs | local-rest) → NEW tool `read_obsidian`
- `github` (oauth | pat) → NEW tool `search_github`
- `db_query` (native, read-only allowlisted) → NEW tool `query_database`
- custom sources → user-defined; map to a generic `custom_query` tool OR no tool (permission-only)

---

## 4. Permission gating — wire `enabled` into the tool/retrieval layer (the real fix)

Today the tool loop calls `listToolDeclarations(personaId)` (no permission check). Change to:
1. `page.tsx`: send `enabledSources: string[]` (ids of enabled sources) in the chat request body (`buildBody`).
2. `app/api/chat/route.ts` → `chatService` → graph state: add `enabledSources`.
3. `lib/ai/tools/registry.ts`: `listToolDeclarations(personaId, enabledSources)` → drop any tool whose `sourceId` is NOT in `enabledSources`.
4. `retrieveContext` (intent.ts/index.ts) already filters by intent; additionally skip a source whose `enabledSources` excludes it.
5. Result: toggling "GitHub" OFF → `search_github` is never offered to the model → never called. Toggling "Job Applications" OFF → `search_jobs` removed. **The toggle is now a true permission.** Persist `enabledSources` in `localStorage` (single-user app) AND/OR a `user_source_permissions` table; for MVP, localStorage is enough and zero-risk (no DB migration).

This reuses the existing graph/tool seam — no new provider work.

---

## 5. Frontend plan (per frontend-design → emi-design-eng craft rules)

**Keep:** the right-side `Sheet` drawer, the toggle switch (already good), the "Connected · N items" / "Disconnected" badges, the `activeCount / total Active` header badge.

**Change set (components):**

### 5.1 Source card — permission-first + auth sub-state
- Each card shows: icon, name, **real** `recordCount`/`lastSync`, toggle.
- If `kind` needs auth and `auth.status === "needed"`: the card shows an amber "Set up required" pill instead of "Connected", and **expands an inline config row** on toggle-on (or via a "Set up" button): GitHub → "Connect with GitHub" (OAuth) or PAT input (password field); Obsidian → vault path input OR "Enable Local REST" token field.
- **Auth sub-panel motion** (emi-design-eng): drawer is *occasional* → standard; the expand is a height/opacity reveal using CSS transition `transform/opacity` only, `ease-out` 200ms, `prefers-reduced-motion` keeps opacity, drops transform. **No `scale(0)`.** Press feedback `scale(0.97)` on buttons.

### 5.2 New sources to add to the list
- **Obsidian Vault** (replaces Notion): icon `BookOpen`→ use `Library`/vault icon; config row = vault path or Local REST token.
- **GitHub Repositories**: config row = "Connect GitHub" (OAuth) / PAT; on connect, real `GET /user/repos` count.
- **Database Query**: icon `Database`; a small "scopes" hint ("Read-only · your tables"); toggle = permission to use `query_database`.
- **LinkedIn / Google Drive / Notion / Email**: **removed** from the seeded list (they were fake).

### 5.3 "Connect source" → real creation modal
- Replace the toast "coming soon" with a **modal** (`Dialog`/centered, `transform-origin: center`, enter `scale(0.97)+opacity` 200ms `ease-out` per emi rules).
- Fields: Display name, Kind (Native table / Local folder / API / Database), optional auth (API key / token / path), a **Scope description** (free text the model sees as the tool description), table/column allowlist for DB.
- On save: insert into `user_sources` (or localStorage MVP), register a dynamic `custom` tool at runtime (`lib/ai/tools/registry.ts` supports adding to `TOOL_REGISTRY` at boot from stored sources), and render a new toggle in the drawer. **This makes "add any new connection scope" real** — exactly your ask.

### 5.4 Motion / craft checklist (emi-design-eng)
| Element | Spec |
|---|---|
| Drawer open/close | 200–500ms, `--ease-drawer: cubic-bezier(0.32,0.72,0,1)` |
| Toggle switch | 200ms `ease-out`, `translate-x` only (already correct) |
| Auth sub-panel expand | height+opacity, 200ms `ease-out`, `@starting-style` |
| Button press | `scale(0.97)` 100–160ms `ease-out` |
| Connect modal | enter `scale(0.97)+opacity:0`→1, 200ms `ease-out`; centered origin |
| Reduced motion | keep opacity/color, drop transforms |
| Hover | gate behind `@media (hover:hover) and (pointer:fine)` |
| List item enter | optional 30–80ms stagger |

---

## 6. Implementation phases (each verifiable, flag/feature-gated, no behavior break)

- **P1 — Permission wiring (highest value, lowest risk):** extend `ContextSource` + send `enabledSources` → gate `listToolDeclarations` + `retrieveContext`. Remove fake counts; show real counts for native sources, `0`/null otherwise. *Verifies the toggle is now real.* No new integrations.
- **P2 — Remove fake sources:** drop LinkedIn/GDrive/Notion/Email from seed; keep native 5 + add `db_query` (read-only allowlisted tool). Update drawer icons/labels.
- **P3 — Obsidian source:** `read_obsidian` tool (fs path or Local REST); config row in drawer; real sync count.
- **P4 — GitHub source:** OAuth App or PAT flow + encrypted token + `search_github` tool (read-only `repo`); config row; real repo count.
- **P5 — Custom "Connect source" modal:** dynamic `custom` tool registration from stored `user_sources`.
- **P6 — Persistence:** promote localStorage → `user_sources` + `user_source_permissions` tables if multi-user readiness desired.

---

## 7. Decisions needed from you (architect resolves via discovery, but these are product calls)

1. **GitHub auth method:** OAuth App (best UX, needs a GitHub OAuth app + callback route) vs **PAT** (simplest, user pastes a token). Recommend PAT for MVP, OAuth later.
2. **Obsidian method:** **filesystem vault path** (server `fs.read`, simplest, free) vs **Local REST API** plugin (cleaner, needs the plugin enabled). Recommend fs-path MVP.
3. **Permission persistence:** localStorage (MVP, zero DB change, single-user) vs `user_sources`/`user_source_permissions` tables (multi-user ready). Recommend localStorage for now.
4. **Database-query scope:** confirm read-only + allowlisted tables (jobs/contacts/links/ai_tool_prompts) — no arbitrary SQL. (Security non-negotiable.)
5. **LinkedIn:** confirm **remove** (no free path). Default = remove.

---

## 8. Scope guards (architect constraints)
- No change to `lib/ai/providers.ts` tool-calling core (built last turn).
- No change to other routes/board/CRM/sidebar.
- Every phase is independently shippable + rollback-able; P1 alone fixes the "theater" complaint.
- Secrets (GitHub token, Obsidian path) handled via existing `lib/encryption`, never logged, redacted in code.
