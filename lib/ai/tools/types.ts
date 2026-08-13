// Tool contract for the chatbot's real (LLM-driven) tool-calling system.
// A tool is a self-contained unit: a JSON-Schema param spec + an execute().
// Add a tool by creating lib/ai/tools/<name>.ts and registering it in registry.ts.

export interface ToolContext {
  userId: string;
  personaId?: string;
  /** Per-source config (Obsidian vaultPath, GitHub token, etc.). NEVER logged. */
  sourceConfig?: Record<string, Record<string, unknown>>;
}

export interface ToolResult {
  /** Text fed back to the model as the tool result. */
  content: string;
  /** Human-readable labels shown in the "Sources used" chip (e.g. "Job Applications"). */
  citations: string[];
}

export interface ToolDefinition {
  /** Unique snake_case name. */
  name: string;
  /** Shown to the model to decide whether to call the tool. */
  description: string;
  /** JSON Schema object describing the tool's parameters. */
  parameters: Record<string, unknown>;
  /** Personas this tool is available for (omit = all personas). */
  personas?: string[];
  /** ContextSource id that gates this tool (omit = always available, e.g. web_search). */
  sourceId?: string;
  /** Read-only by design. Never mutates user data. */
  execute: (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult>;
}

export interface ToolCallRecord {
  name: string;
  args: Record<string, unknown>;
  result?: ToolResult;
  status: "called" | "done" | "error";
  error?: string;
}
