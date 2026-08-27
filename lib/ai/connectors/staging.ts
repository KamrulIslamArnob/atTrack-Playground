// Universal Autonomy & Permission Staging Engine for Connectors.
// Centralizes policy decisions across all current and future connected resources.

import type { PermissionMode } from "@/lib/ai-chatbot/composer-settings";
import { getConnector } from "./registry";
import type {
  AccessDecision,
  ConnectorActionType,
  StageConnectorOperationInput,
  StagedOperationResult,
} from "./types";

/**
 * Evaluate whether an action on a specific connector is allowed, requires interactive approval,
 * or is blocked under the active autonomy permission mode.
 */
export function evaluateConnectorAccess(
  connectorId: string,
  action: ConnectorActionType,
  permissionMode: PermissionMode = "bypass"
): AccessDecision {
  const connector = getConnector(connectorId);
  const connectorName = connector?.name ?? connectorId;

  // 1. Read-only mode blocks all mutating actions (write, delete, execute) immediately.
  if (permissionMode === "readonly") {
    if (action === "read") {
      return { status: "allowed" };
    }
    return {
      status: "blocked",
      reason: `Blocked: Read-only (View) mode is active. Operations that modify state or execute actions on "${connectorName}" are prevented.`,
      recommendation: `Switch to "Ask before changes" or "Bypass permissions" in the composer toolbar to allow modifications.`,
    };
  }

  // 2. Strict mode prompts for interactive approval on every operation, including reads.
  if (permissionMode === "strict") {
    return {
      status: "stage_approval",
      reason: `Strict confirmation mode requires explicit user sign-off for all operations on "${connectorName}".`,
    };
  }

  // 3. Ask mode allows transparent reads, but stages all state-modifying writes/deletes/executions.
  if (permissionMode === "ask") {
    if (action === "read") {
      return { status: "allowed" };
    }
    return {
      status: "stage_approval",
      reason: `Waiting for user confirmation before modifying records or executing actions on "${connectorName}".`,
    };
  }

  // 4. Bypass permissions (Auto mode): full direct execution.
  return { status: "allowed" };
}

/**
 * Universal staging helper. Current and future tools invoke this helper to automatically
 * enforce read-only blocks, interactive approvals, or direct execution.
 */
export function stageConnectorOperation(
  input: StageConnectorOperationInput
): StagedOperationResult {
  const mode = input.permissionMode ?? "bypass";
  const decision = evaluateConnectorAccess(input.connectorId, input.action, mode);

  if (decision.status === "blocked") {
    const message = `${decision.reason}\n\n${decision.recommendation ?? ""}`.trim();
    return {
      status: "blocked",
      result: {
        content: message,
        citations: [input.targetResource],
      },
    };
  }

  if (decision.status === "stage_approval") {
    if (!input.buildApproval) {
      return {
        status: "blocked",
        result: {
          content: `Operation requires approval but no interactive approval builder was provided for "${input.connectorId}".`,
          citations: [input.targetResource],
        },
      };
    }

    const built = input.buildApproval();
    const expiresAt = built.expiresAt ?? Date.now() + 60_000;
    const approvalPayload = {
      approvalId: built.approvalId,
      label: built.label ?? input.targetResource,
      preview: built.preview,
      sql: built.sql ?? "",
      expiresAt,
      kind: built.kind ?? (input.action === "delete" ? "delete" : "write"),
      table: built.table ?? input.targetResource,
      action: built.action ?? input.action,
    };

    return {
      status: "stage_approval",
      approval: approvalPayload,
      result: {
        content: `Ready to execute ${input.action} on ${input.targetResource}.\n\nWaiting for your approval (${mode === "strict" ? "Strict confirmation" : "Ask before changes"}). Click Allow to proceed, or Deny to cancel.`,
        citations: [input.targetResource],
        approval: approvalPayload,
      },
    };
  }

  return { status: "allowed" };
}
