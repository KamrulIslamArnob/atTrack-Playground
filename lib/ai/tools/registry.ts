import type { ToolDefinition } from "./types";
import { searchJobsTool } from "./search-jobs";
import { getResumeTool } from "./get-resume";
import { searchContactsTool } from "./search-contacts";
import { searchLinksTool } from "./search-links";
import { searchAiPromptsTool } from "./search-ai-prompts";
import { searchMemoriesTool } from "./search-memories";
import { webSearchTool } from "./web-search";
import { queryDatabaseTool } from "./query-database";
import { readObsidianTool } from "./read-obsidian";
import { searchGithubTool } from "./search-github";

/**
 * The tool registry. To add a tool: create lib/ai/tools/<name>.ts exporting a
 * ToolDefinition (with an optional `sourceId` linking it to a Workspace Source
 * permission), then add it to this array. The graph, provider loop, and UI
 * pick it up automatically — no other file needs to change.
 */
export const TOOL_REGISTRY: ToolDefinition[] = [
  searchJobsTool,
  getResumeTool,
  searchContactsTool,
  searchLinksTool,
  searchAiPromptsTool,
  searchMemoriesTool,
  queryDatabaseTool,
  readObsidianTool,
  searchGithubTool,
  webSearchTool,
];

export function getTool(name: string): ToolDefinition | undefined {
  return TOOL_REGISTRY.find((t) => t.name === name);
}

function isSourceAllowed(toolSourceId: string | undefined, enabledSourceIds?: string[]): boolean {
  if (!toolSourceId || !enabledSourceIds) return true;
  if (enabledSourceIds.includes(toolSourceId)) return true;
  // Social link and CRM merge: granting CRM ("contacts") also gives social link ("links") access and vice-versa
  if (toolSourceId === "links" && enabledSourceIds.includes("contacts")) return true;
  if (toolSourceId === "contacts" && enabledSourceIds.includes("links")) return true;
  return false;
}

/** JSON-Schema declarations for the active provider, filtered by persona AND
 * by the user's enabled source permissions. A tool whose `sourceId` is set but
 * NOT in `enabledSourceIds` is withheld from the model — this is the real
 * permission gate. Omit `enabledSourceIds` to skip gating (legacy path). */
export function listToolDeclarations(
  personaId?: string,
  enabledSourceIds?: string[]
): Record<string, unknown>[] {
  return TOOL_REGISTRY.filter((t) => {
    if (t.personas && !t.personas.includes(personaId ?? "")) return false;
    if (!isSourceAllowed(t.sourceId, enabledSourceIds)) return false;
    return true;
  }).map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
    sourceId: t.sourceId,
  }));
}

/** Tools available to the model given persona + enabled sources (full defs). */
export function getEnabledTools(personaId?: string, enabledSourceIds?: string[]): ToolDefinition[] {
  return TOOL_REGISTRY.filter((t) => {
    if (t.personas && !t.personas.includes(personaId ?? "")) return false;
    if (!isSourceAllowed(t.sourceId, enabledSourceIds)) return false;
    return true;
  });
}

/** Register a custom (user-defined) tool at runtime (from stored sources). */
export function registerTool(tool: ToolDefinition): void {
  if (!TOOL_REGISTRY.find((t) => t.name === tool.name)) {
    TOOL_REGISTRY.push(tool);
  }
}
