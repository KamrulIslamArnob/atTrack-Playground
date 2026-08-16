"use client";

import { useState } from "react";
import { AlertTriangle, Trash2, Database, Code2 } from "lucide-react";
import { ChevronDownIcon } from "@/components/ui/chevron-down";
import { ChevronUpIcon } from "@/components/ui/chevron-up";
import { XIcon } from "@/components/ui/x";
import { cn } from "@/lib/utils";
import type { DbApproval } from "@/lib/ai-chatbot/use-chat";
import { motion, AnimatePresence } from "motion/react";

interface DbDeleteApprovalCardProps {
  approval: DbApproval;
  disabled?: boolean;
  onAllow: () => void;
  onDeny: () => void;
}

export default function DbDeleteApprovalCard({
  approval,
  disabled,
  onAllow,
  onDeny,
}: DbDeleteApprovalCardProps) {
  const [showSql, setShowSql] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState<"allow" | "deny" | null>(null);

  const handleChoice = (choice: "allow" | "deny") => {
    setSelectedChoice(choice);
    if (choice === "allow") {
      onAllow();
    } else {
      onDeny();
    }
  };

  return (
    <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-destructive/40 bg-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <AlertTriangle className="size-4" />
          </span>
          <div>
            <h4 className="text-sm font-semibold text-foreground">
              Confirm deletion from {approval.label}
            </h4>
            <p className="text-xs text-muted-foreground">
              This action is permanent and cannot be undone.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onDeny}
          disabled={disabled}
          className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          title="Dismiss"
        >
          <XIcon className="size-4" />
        </button>
      </div>

      {/* Target Preview Data */}
      {approval.preview && (
        <div className="rounded-xl border border-border bg-muted/30 p-2.5 space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <Database className="size-3.5" />
            <span>Target records:</span>
          </div>
          <pre className="max-h-28 overflow-auto font-mono text-[11px] leading-relaxed text-foreground whitespace-pre-wrap">
            {approval.preview}
          </pre>
        </div>
      )}

      {/* SQL Statement Expandable Toggle */}
      <div>
        <button
          type="button"
          onClick={() => setShowSql((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground active:scale-95 transition-colors cursor-pointer"
        >
          <Code2 className="size-3.5" />
          <span>{showSql ? "Hide SQL query" : "View SQL query"}</span>
          {showSql ? <ChevronUpIcon className="size-3.5" /> : <ChevronDownIcon className="size-3.5" />}
        </button>
        <AnimatePresence>
          {showSql && (
            <motion.pre
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-1.5 overflow-auto rounded-xl border border-border bg-muted/30 p-2.5 font-mono text-[11px] text-foreground"
            >
              {approval.sql}
            </motion.pre>
          )}
        </AnimatePresence>
      </div>

      {/* Interactive Approval Options */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-border">
        <button
          type="button"
          disabled={disabled}
          onClick={() => handleChoice("deny")}
          className={cn(
            "flex items-center justify-between rounded-xl border border-border px-3 py-2 text-xs font-medium transition-all active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
            selectedChoice === "deny"
              ? "bg-muted text-foreground font-semibold"
              : "hover:bg-muted text-foreground"
          )}
        >
          <span className="flex items-center gap-1.5">
            <XIcon className="size-3.5 text-muted-foreground" />
            <span>Deny & keep data</span>
          </span>
          <span className="text-[10px] text-muted-foreground">Safe</span>
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={() => handleChoice("allow")}
          className={cn(
            "flex items-center justify-between rounded-xl border border-destructive/40 bg-destructive text-destructive-foreground px-3 py-2 text-xs font-semibold transition-all hover:bg-destructive/90 active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
            selectedChoice === "allow" && "ring-2 ring-destructive/40"
          )}
        >
          <span className="flex items-center gap-1.5">
            <Trash2 className="size-3.5" />
            <span>Allow delete</span>
          </span>
          <span className="text-[10px] bg-destructive-foreground/20 text-destructive-foreground px-1.5 py-0.2 rounded font-mono">
            Execute
          </span>
        </button>
      </div>
    </div>
  );
}
