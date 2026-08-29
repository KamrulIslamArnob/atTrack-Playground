"use client";

export type ReasoningEffortLevel = "off" | "low" | "medium" | "high" | "max";
export type PermissionMode = "bypass" | "ask" | "strict" | "readonly";
export type ExecutionTarget = "local" | "sandbox" | "cloud";

export interface ComposerSettings {
  reasoningEffort: ReasoningEffortLevel;
  permissionMode: PermissionMode;
  executionTarget: ExecutionTarget;
  isContinuousDictation?: boolean;
}

const STORAGE_KEY = "attrack_composer_settings_v1";

const DEFAULT_SETTINGS: ComposerSettings = {
  reasoningEffort: "max",
  // "ask" — not "bypass" — is the safe-by-default floor: a new install (or
  // any session that hasn't touched this toggle) stages writes/deletes for
  // an explicit Allow/Deny instead of auto-executing them. Users who want
  // full autonomy can still opt into Bypass from the composer toolbar; they
  // just don't start there. (Deletes now stage regardless of mode — see
  // lib/ai/connectors/staging.ts — but keeping this "ask" too means an
  // out-of-the-box install also confirms writes, not just deletes.)
  permissionMode: "ask",
  executionTarget: "local",
  isContinuousDictation: false,
};

function notify(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("attrack-composer-settings-updated"));
}

export function getComposerSettings(): ComposerSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function setComposerSettings(partial: Partial<ComposerSettings>): void {
  if (typeof window === "undefined") return;
  try {
    const current = getComposerSettings();
    const next = { ...current, ...partial };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    notify();
  } catch {}
}

export const REASONING_EFFORT_CONFIG: Record<
  ReasoningEffortLevel,
  { label: string; budgetTokens: number; description: string; stepIndex: number }
> = {
  off: {
    label: "Off",
    budgetTokens: 0,
    description: "Fastest response without thinking deliberation",
    stepIndex: 0,
  },
  low: {
    label: "Low",
    budgetTokens: 1024,
    description: "Light reasoning for direct, straightforward queries",
    stepIndex: 1,
  },
  medium: {
    label: "Medium",
    budgetTokens: 4096,
    description: "Balanced reasoning depth and responsiveness",
    stepIndex: 2,
  },
  high: {
    label: "High",
    budgetTokens: 8192,
    description: "Deep reasoning for complex planning and analysis",
    stepIndex: 3,
  },
  max: {
    label: "Max",
    budgetTokens: 16384,
    description: "Maximum reasoning effort for comprehensive multi-step synthesis",
    stepIndex: 4,
  },
};

export const PERMISSION_MODE_CONFIG: Record<
  PermissionMode,
  { label: string; description: string; badge: string; icon: string }
> = {
  bypass: {
    label: "Bypass permissions",
    description: "Execute directly: database and connected tools run automatically",
    badge: "Auto",
    icon: "zap",
  },
  ask: {
    label: "Ask before changes",
    description: "Confirm writes and external actions on database and connectors",
    badge: "Safe",
    icon: "shield",
  },
  strict: {
    label: "Strict confirmation",
    description: "Prompt for approval on all tool, connector, and database operations",
    badge: "Strict",
    icon: "lock",
  },
  readonly: {
    label: "Read only",
    description: "Safe mode: inspect data without permitting any writes or mutations",
    badge: "View",
    icon: "eye",
  },
};
