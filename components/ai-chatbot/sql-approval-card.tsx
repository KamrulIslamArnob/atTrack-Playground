"use client";

import { useState } from "react";
import { Database, Code2, ShieldAlert } from "lucide-react";
import { CheckIcon } from "@/components/ui/check";
import { XIcon } from "@/components/ui/x";
import { ChevronDownIcon } from "@/components/ui/chevron-down";
import { ChevronUpIcon } from "@/components/ui/chevron-up";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface SQLApprovalCardProps {
  intentDescription: string;
  sqlQuery?: string;
  tableName?: string;
  onApprove: () => void;
  onDeny: () => void;
  status?: "pending" | "approved" | "denied";
}

export function SQLApprovalCard({
  intentDescription,
  sqlQuery = "SELECT j.id, j.title, j.company_name, d.due_date, d.title AS stage_deadline FROM jobs j LEFT JOIN job_deadlines d ON j.id = d.job_id ORDER BY d.due_date ASC;",
  tableName = "jobs JOIN job_deadlines",
  onApprove,
  onDeny,
  status = "pending",
}: SQLApprovalCardProps) {
  const [showQuery, setShowQuery] = useState(false);
  const [cardStatus, setCardStatus] = useState<"pending" | "approved" | "denied">(status);

  function handleApprove() {
    setCardStatus("approved");
    onApprove();
  }

  function handleDeny() {
    setCardStatus("denied");
    onDeny();
  }

  if (cardStatus === "approved") {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-xl border border-status-online/30 bg-status-online/10 px-3.5 py-2.5 text-xs text-status-online">
        <CheckIcon className="size-4 shrink-0 text-status-online" />
        <span>Database access approved. Accessing <strong>{tableName}</strong> records...</span>
      </div>
    );
  }

  if (cardStatus === "denied") {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive">
        <XIcon className="size-4 shrink-0" />
        <span>Database query denied by user.</span>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-2xl border border-primary/20 bg-card/90 p-4 backdrop-blur-md">
      <div className="flex items-start gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
          <Database className="size-4" />
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              Data Permission Request
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <ShieldAlert className="size-3" /> Requires Approval
            </span>
          </div>

          <p className="text-sm text-foreground leading-relaxed font-medium">
            {intentDescription || `I'm going to extract this data from the ${tableName} table by joining stage deadlines and job details.`}
          </p>

          {sqlQuery && (
            <div>
              <button
                type="button"
                onClick={() => setShowQuery((prev) => !prev)}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <Code2 className="size-3.5 text-primary" />
                <span>{showQuery ? "Hide SQL Query" : "Preview SQL Query"}</span>
                {showQuery ? <ChevronUpIcon className="size-3" /> : <ChevronDownIcon className="size-3" />}
              </button>

              {showQuery && (
                <div className="mt-2 rounded-xl bg-muted/60 p-3 font-mono text-xs text-foreground overflow-x-auto border border-border/50">
                  <pre className="whitespace-pre-wrap break-all">{sqlQuery}</pre>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              onClick={handleApprove}
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold rounded-xl text-xs h-8 px-3.5 cursor-pointer"
            >
              <CheckIcon className="size-3.5 mr-1" />
              Approve & Run Query
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDeny}
              className="rounded-xl text-xs h-8 px-3 text-muted-foreground hover:text-destructive border-border/60 hover:bg-destructive/10 cursor-pointer"
            >
              <XIcon className="size-3.5 mr-1" />
              Deny
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
