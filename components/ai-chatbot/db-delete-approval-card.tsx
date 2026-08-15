"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DbApproval } from "@/lib/ai-chatbot/use-chat";

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

  return (
    <div className="mt-3 rounded-2xl border border-destructive/30 bg-card/90 p-4 backdrop-blur-md">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl border border-destructive/20 bg-destructive/10 text-destructive">
          <AlertTriangle className="size-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-semibold text-foreground">
            Confirm deletion from {approval.label}
          </p>
          <p className="text-xs text-muted-foreground">
            This action is permanent and cannot be undone. Deny to keep the data untouched.
          </p>

          {approval.preview && (
            <pre className="max-h-32 overflow-auto rounded-xl bg-muted/60 p-3 font-mono text-[11px] leading-relaxed text-foreground border border-border/50">
              {approval.preview}
            </pre>
          )}

          <button
            type="button"
            onClick={() => setShowSql((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            {showSql ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            <span>{showSql ? "Hide SQL" : "Show SQL"}</span>
          </button>
          {showSql && (
            <pre className="overflow-auto rounded-xl bg-muted/60 p-3 font-mono text-[11px] text-foreground border border-border/50">
              {approval.sql}
            </pre>
          )}

          <div className="flex items-center gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              disabled={disabled}
              onClick={onAllow}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-semibold rounded-xl text-xs h-8 px-3.5 cursor-pointer"
            >
              <Trash2 className="size-3.5 mr-1" />
              Allow delete
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={onDeny}
              className="rounded-xl text-xs h-8 px-3 text-muted-foreground hover:text-destructive border-border/60 hover:bg-destructive/10 cursor-pointer"
            >
              <X className="size-3.5 mr-1" />
              Deny
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
