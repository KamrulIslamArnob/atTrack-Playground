// Generic Connector and Access Staging Framework for atTrack AI subsystem.
// Standardizes how database access, external APIs, and future features
// (email, github, filesystem, shell, webhooks) evaluate autonomy levels,
// enforce read-only policies, and stage interactive confirmation approvals.

import type { PermissionMode } from "@/lib/ai-chatbot/composer-settings";
import type { ToolApproval, ToolResult } from "@/lib/ai/tools/types";

export type ConnectorActionType = "read" | "write" | "delete" | "execute";

export type ConnectorCategory =
  | "data"
  | "search"
  | "communication"
  | "developer"
  | "system"
  | "external";

export interface ConnectorCapability {
  action: ConnectorActionType;
  description: string;
  /** Whether this capability modifies state or has side-effects (requires confirmation in 'ask' mode). */
  mutating: boolean;
  /** Whether this capability is high-risk / destructive (e.g. DELETE). */
  destructive?: boolean;
}

export interface ConnectorDefinition {
  /** Unique snake_case or kebab-case identifier (e.g. "database", "web_search", "email", "github"). */
  id: string;
  /** Human-readable display label. */
  name: string;
  /** Short description of the connector's role and capabilities. */
  description: string;
  category: ConnectorCategory;
  /** List of actions supported by this connector. */
  capabilities: ConnectorCapability[];
  /** Optional icon name for UI rendering. */
  iconName?: string;
}

export type AccessDecisionStatus = "allowed" | "stage_approval" | "blocked";

export interface AccessDecision {
  status: AccessDecisionStatus;
  /** Explanation for why the action was blocked or staged. */
  reason?: string;
  /** Recommended user action if blocked. */
  recommendation?: string;
}

export interface StageConnectorOperationInput {
  connectorId: string;
  action: ConnectorActionType;
  permissionMode?: PermissionMode;
  userId: string;
  targetResource: string;
  details?: Record<string, unknown>;
  /** Callback to construct the ToolApproval payload if interactive approval is required. */
  buildApproval?: () => {
    approvalId: string;
    preview: string;
    sql?: string;
    label?: string;
    kind?: "write" | "delete" | "tool";
    expiresAt?: number;
    table?: string;
    action?: string;
  };
}

export type StagedOperationResult =
  | { status: "allowed" }
  | { status: "blocked"; result: ToolResult }
  | { status: "stage_approval"; result: ToolResult; approval: ToolApproval };
