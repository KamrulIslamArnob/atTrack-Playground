"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Trash2, Database, Code2, Clock, X } from "lucide-react";
import { ChevronDownIcon } from "@/components/ui/chevron-down";
import { ChevronUpIcon } from "@/components/ui/chevron-up";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DbApproval } from "@/lib/ai-chatbot/use-chat";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";

interface ApprovalModalProps {
  approval: DbApproval | null;
  onAllow: (approvalId: string) => void;
  onDeny: (approvalId: string) => void;
  onTimeout?: (approvalId: string) => void;
}

export function ApprovalModal({ approval, onAllow, onDeny, onTimeout }: ApprovalModalProps) {
  const [showSql, setShowSql] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isWrite = approval?.kind === "write";
  const isDelete = !isWrite; // default to delete for backwards compatibility

  useEffect(() => {
    if (!approval) {
      setTimeLeft(60);
      setShowSql(false);
      setIsSubmitting(false);
      return;
    }

    // Calculate remaining seconds if expiresAt is set, else default 60s
    const calculateSeconds = () => {
      if (approval.expiresAt) {
        const diff = Math.max(0, Math.ceil((approval.expiresAt - Date.now()) / 1000));
        return Math.min(60, diff);
      }
      return 60;
    };

    setTimeLeft(calculateSeconds());

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          const msg = isWrite
            ? "Write request timed out after 60s without confirmation. Cancelled safely."
            : "Deletion request timed out after 60s without confirmation. Cancelled safely.";
          toast.warning(msg);
          if (onTimeout) {
            onTimeout(approval.approvalId);
          } else {
            onDeny(approval.approvalId);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [approval, onDeny, onTimeout, isWrite]);

  if (!approval) return null;

  const handleDecision = (decision: "allow" | "deny") => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    if (decision === "allow") {
      onAllow(approval.approvalId);
    } else {
      onDeny(approval.approvalId);
    }
  };

  const progressPercent = (timeLeft / 60) * 100;

  const kindLabel = isWrite ? (approval.action === "update" ? "Update" : "Create") : "Deletion";
  const headerTitle = isWrite
    ? `Confirm ${kindLabel} in ${approval.label}`
    : `Confirm Deletion from ${approval.label}`;
  const headerDesc = isWrite
    ? `This will ${approval.action === "update" ? "update" : "create"} data in your local database. Please review the details below.`
    : "Dangerous action: this will permanently remove data from your local database.";
  const iconBg = isWrite ? "bg-primary/15 text-primary border-primary/20" : "bg-destructive/15 text-destructive border-destructive/20";
  const cardBorder = isWrite ? "border-primary/30" : "border-destructive/40";
  const allowLabel = isWrite ? (approval.action === "update" ? "Allow & Update" : "Allow & Create") : "Allow & Delete";
  const previewTitle = isWrite ? "Data Preview:" : "Target Records:";

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className={cn("w-full max-w-lg overflow-hidden rounded-2xl border bg-card p-6 shadow-2xl space-y-4", cardBorder)}
        >
          {/* Header with Countdown Badge */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl border shadow-xs", iconBg)}>
                {isWrite ? <Database className="size-5" /> : <AlertTriangle className="size-5" />}
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  {headerTitle}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {headerDesc}
                </p>
              </div>
            </div>

            {/* Countdown Badge */}
            <div
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tabular-nums border shrink-0",
                timeLeft <= 10
                  ? "bg-destructive/20 text-destructive border-destructive/40 animate-pulse"
                  : "bg-warning-surface text-warning border-warning-border"
              )}
              title="Time remaining to confirm"
            >
              <Clock className="size-3.5" />
              <span>{timeLeft}s</span>
            </div>
          </div>

          {/* Progress bar countdown */}
          <div className="w-full bg-muted/60 h-1 rounded-full overflow-hidden">
            <motion.div
              className={cn(
                "h-full rounded-full transition-all duration-1000 linear",
                timeLeft <= 10 ? "bg-destructive" : "bg-warning"
              )}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Target Preview Data */}
          {approval.preview && (
            <div className="rounded-xl border border-border bg-muted/40 p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Database className="size-3.5 text-primary" />
                <span>{previewTitle}</span>
              </div>
              <pre className="text-[11px] font-mono text-muted-foreground whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto p-1">
                {approval.preview}
              </pre>
            </div>
          )}

          {/* Collapsible SQL Preview */}
          {approval.sql && (
            <div className="rounded-xl border border-border/80 bg-muted/20 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowSql((prev) => !prev)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/40 transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <Code2 className="size-3.5 text-muted-foreground" />
                  <span>View Prepared SQL Query</span>
                </span>
                {showSql ? <ChevronUpIcon className="size-3.5" /> : <ChevronDownIcon className="size-3.5" />}
              </button>

              {showSql && (
                <div className="border-t border-border/60 p-2.5 bg-zinc-950 text-zinc-200 text-[11px] font-mono overflow-x-auto leading-relaxed">
                  <code>{approval.sql}</code>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleDecision("deny")}
              disabled={isSubmitting}
              className="rounded-lg text-xs font-semibold h-9 px-4 cursor-pointer"
            >
              Cancel (Deny)
            </Button>

            <Button
              type="button"
              variant={isWrite ? "default" : "destructive"}
              size="sm"
              onClick={() => handleDecision("allow")}
              disabled={isSubmitting}
              className="rounded-lg text-xs font-semibold h-9 px-4 gap-1.5 cursor-pointer shadow-xs"
            >
              {isWrite ? <Database className="size-3.5" /> : <Trash2 className="size-3.5" />}
              <span>{allowLabel}</span>
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
