// Tool contract for the chatbot's real (LLM-driven) tool-calling system.
// A tool is a self-contained unit: a JSON-Schema param spec + an execute().
// Add a tool by creating lib/ai/tools/<name>.ts and registering it in registry.ts.

import type { PermissionMode } from "@/lib/ai-chatbot/composer-settings";
import type { ChatArtifact } from "@/lib/types/chat-artifact";

export interface ToolContext {
  userId: string;
  personaId?: string;
  /** Per-source config (Obsidian vaultPath, GitHub token, etc.). NEVER logged. */
  sourceConfig?: Record<string, Record<string, unknown>>;
  /** The current turn's trace id (see lib/ai-chatbot/pipeline.ts). Used by
   *  delete_database to prove a confirming call happened in a LATER turn
   *  than the one that proposed the delete, not the same tool round. */
  traceId?: string;
  /** Composer permission mode for this turn (bypass/ask/strict/readonly). */
  permissionMode?: PermissionMode;
}

export interface ToolApproval {
  /** Server-generated id the client sends back with its Allow/Deny decision. */
  approvalId: string;
  /** Human-readable table label (e.g. "Job Applications"). */
  label: string;
  /** Human-readable summary of the rows about to be deleted. */
  preview: string;
  /** The literal SQL that would run on approval. */
  sql: string;
  /** Epoch millisecond timestamp when this approval auto-expires (default 60 seconds). */
  expiresAt?: number;
  /** Kind of operation requiring approval (for UI). */
  kind?: "delete" | "write" | "tool";
  /** For write approvals: table and action for display. */
  table?: string;
  action?: string;
}

export interface ToolResult {
  /** Text fed back to the model as the tool result. */
  content: string;
  /** Human-readable labels shown in the "Sources used" chip (e.g. "Job Applications"). */
  citations: string[];
  /** Present when this tool call needs the user's interactive sign-off before
   *  any side effect runs (e.g. a DELETE). The pipeline emits an `approval`
   *  SSE frame carrying this so the client can render an Allow/Deny card. */
  approval?: ToolApproval;
  /** Inline artifact card snapshot created by this tool call (e.g. job card).
   *  Rendered in chat below the markdown, persisted inside message.toolSteps JSON. */
  artifact?: ChatArtifact;
  /** Multiple cards (e.g. batch insert) — preferred over single `artifact`. */
  artifacts?: ChatArtifact[];
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
  /** Connector id this tool connects with (e.g. "database", "web_search", "email", "github"). */
  connectorId?: string;
  /** Type of action executed by this tool (read, write, delete, execute). */
  actionType?: "read" | "write" | "delete" | "execute";
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
