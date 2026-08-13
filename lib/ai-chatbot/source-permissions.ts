"use client";

// MVP permission persistence for Workspace Sources. Single-user, self-hosted:
// everything lives in localStorage. No DB migration, no server-side user table.
// Secrets (GitHub PAT, Obsidian path) are stored obfuscated-at-rest in the
// browser (NOT plaintext), sent only to the local server over the chat request,
// used server-side, and never logged.

import type { ContextSource } from "./types";

const PERM_KEY = "attrack_source_permissions_v1";

interface SourcePermissionStore {
  // sourceId -> enabled override (absence means "use seed default")
  enabled: Record<string, boolean>;
  // sourceId -> config (e.g. { vaultPath }, { token })
  config: Record<string, Record<string, unknown>>;
  // user-created sources (added via the Connect modal)
  custom: ContextSource[];
}

function emptyStore(): SourcePermissionStore {
  return { enabled: {}, config: {}, custom: [] };
}

function read(): SourcePermissionStore {
  if (typeof window === "undefined") return emptyStore();
  try {
    const raw = window.localStorage.getItem(PERM_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as Partial<SourcePermissionStore>;
    return {
      enabled: parsed.enabled ?? {},
      config: parsed.config ?? {},
      custom: parsed.custom ?? [],
    };
  } catch {
    return emptyStore();
  }
}

function write(store: SourcePermissionStore): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PERM_KEY, JSON.stringify(store));
  } catch {
    /* ignore quota / serialization errors */
  }
}

// --- light client-side obfuscation (MVP, single-user, not plaintext-at-rest) ---
function obf(s: string): string {
  try {
    return btoa(unescape(encodeURIComponent(s)));
  } catch {
    return s;
  }
}
function unobf(s: string): string {
  try {
    return decodeURIComponent(escape(atob(s)));
  } catch {
    return s;
  }
}

/** Read whether a source is enabled, merging the seed default with overrides. */
export function isSourceEnabled(seed: ContextSource): boolean {
  const store = read();
  if (seed.id in store.enabled) return store.enabled[seed.id];
  return seed.enabled;
}

/** Persist a toggle. Returns the new enabled state. */
export function setSourceEnabled(id: string, enabled: boolean): void {
  const store = read();
  store.enabled[id] = enabled;
  write(store);
}

/** Get a source's config (secrets returned in plaintext for in-memory use). */
export function getSourceConfig(id: string): Record<string, unknown> | undefined {
  const store = read();
  const cfg = store.config[id];
  if (!cfg) return undefined;
  // de-obfuscate any value stored as { __obf: true, v: "..." }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(cfg)) {
    if (v && typeof v === "object" && (v as { __obf?: boolean }).__obf) {
      out[k] = unobf((v as { v: string }).v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/** Save a source's config. Any value marked secret is obfuscated at rest. */
export function setSourceConfig(id: string, config: Record<string, unknown>, secretKeys: string[] = []): void {
  const store = read();
  const saved: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(config)) {
    if (secretKeys.includes(k) && typeof v === "string") {
      saved[k] = { __obf: true, v: obf(v) };
    } else {
      saved[k] = v;
    }
  }
  store.config[id] = saved;
  write(store);
}

export function getCustomSources(): ContextSource[] {
  return read().custom;
}

export function addCustomSource(src: ContextSource): void {
  const store = read();
  store.custom = [...store.custom.filter((s) => s.id !== src.id), src];
  write(store);
}

export function removeCustomSource(id: string): void {
  const store = read();
  store.custom = store.custom.filter((s) => s.id !== id);
  delete store.enabled[id];
  delete store.config[id];
  write(store);
}

/**
 * Build the payload sent to the server for permission + config gating.
 * `sources` = the full seeded list (real counts). We return:
 *  - enabledSourceIds: ids the user has toggled on
 *  - sourceConfig: config with secrets de-obfuscated (sent to local server)
 */
export function buildSourcePayload(sources: ContextSource[]): {
  enabledSourceIds: string[];
  sourceConfig: Record<string, Record<string, unknown>>;
} {
  const store = read();
  const enabledSourceIds: string[] = [];
  const sourceConfig: Record<string, Record<string, unknown>> = {};
  for (const s of sources) {
    const on = s.id in store.enabled ? store.enabled[s.id] : s.enabled;
    if (on) enabledSourceIds.push(s.id);
    const cfg = store.config[s.id];
    if (cfg) {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(cfg)) {
        if (v && typeof v === "object" && (v as { __obf?: boolean }).__obf) {
          out[k] = unobf((v as { v: string }).v);
        } else {
          out[k] = v;
        }
      }
      sourceConfig[s.id] = out;
    }
  }
  // include custom sources' config too
  for (const c of store.custom) {
    if (c.enabled) enabledSourceIds.push(c.id);
    const cfg = store.config[c.id];
    if (cfg) {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(cfg)) {
        if (v && typeof v === "object" && (v as { __obf?: boolean }).__obf) {
          out[k] = unobf((v as { v: string }).v);
        } else {
          out[k] = v;
        }
      }
      sourceConfig[c.id] = out;
    }
  }
  return { enabledSourceIds, sourceConfig };
}
