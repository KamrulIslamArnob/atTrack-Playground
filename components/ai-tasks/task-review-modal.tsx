"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { saveAiToolAsDocument } from "@/lib/actions/ai-tools";
import { aiToolLabel } from "@/lib/types/ai-tools";
import {
  Sparkles,
  CheckCircle2,
  X,
  FileText,
  Building2,
  MapPin,
  Banknote,
  GraduationCap,
  Briefcase,
  Gift,
  Calendar,
  UserCheck,
  Check,
  ExternalLink,
  Copy,
  Save,
} from "lucide-react";
import type { AITask } from "@/lib/types/ai-task";

interface TaskReviewModalProps {
  task: AITask | null;
  open: boolean;
  onClose: () => void;
  onApply: (taskId: string) => Promise<boolean>;
  onDismiss: (taskId: string) => void;
}

export function TaskReviewModal({
  task,
  open,
  onClose,
  onApply,
  onDismiss,
}: TaskReviewModalProps) {
  const [applying, setApplying] = useState(false);
  const [savingDoc, setSavingDoc] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!open || !task) return null;

  // Handle AI Tool generation tasks (Cover letter, follow-up, interview prep, etc.)
  if (task.type === "ai_tool_generation" && task.result?.generatedEmail) {
    const email = task.result.generatedEmail;
    const kind = task.result.toolKind ?? task.payload.kind;
    const jobId = task.payload.jobId;
    const label = kind ? aiToolLabel(kind) : "AI Generated Content";

    const handleCopy = async () => {
      const text = [email.subject ? `Subject: ${email.subject}\n\n` : "", email.body]
        .filter(Boolean)
        .join("");
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copied content to clipboard");
      setTimeout(() => setCopied(false), 2000);
    };

    const handleSaveDoc = async () => {
      if (!jobId || !kind) return;
      setSavingDoc(true);
      try {
        await saveAiToolAsDocument(jobId, kind, email.subject, email.body);
        toast.success("Saved as document in Documents library");
        onDismiss(task.id);
        onClose();
      } catch {
        toast.error("Could not save document");
      } finally {
        setSavingDoc(false);
      }
    };

    const handleDismiss = () => {
      onDismiss(task.id);
      onClose();
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
        <div className="w-full max-w-xl rounded-3xl border border-border bg-card p-6 shadow-2xl max-h-[88vh] flex flex-col">
          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-border/60 pb-3 shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                <Sparkles className="size-4.5" />
              </div>
              <div>
                <h2 className="font-heading text-base font-semibold">
                  {label}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {task.title} {task.subtitle ? `· ${task.subtitle}` : ""}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close review dialog"
              className="flex size-8 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="mt-4 flex-1 overflow-y-auto space-y-3.5 pr-1 text-xs">
            {email.subject && (
              <div className="rounded-2xl border border-border/70 bg-muted/30 p-3.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                  Subject
                </span>
                <p className="text-xs font-semibold text-foreground select-text">
                  {email.subject}
                </p>
              </div>
            )}

            <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-2">
                Content
              </span>
              <div className="whitespace-pre-wrap text-xs text-foreground/90 leading-relaxed font-sans select-text">
                {email.body}
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="mt-4 border-t border-border/60 pt-3 flex items-center justify-between gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDismiss}
              className="rounded-xl text-xs text-muted-foreground hover:text-destructive hover:border-destructive/40 cursor-pointer"
            >
              Dismiss Task
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="rounded-xl text-xs gap-1.5 cursor-pointer"
              >
                {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
                {copied ? "Copied" : "Copy text"}
              </Button>
              {jobId && kind && (
                <Button
                  type="button"
                  size="sm"
                  disabled={savingDoc}
                  onClick={handleSaveDoc}
                  className="rounded-xl text-xs gap-1.5 cursor-pointer bg-primary text-primary-foreground font-semibold"
                >
                  {savingDoc ? <Spinner className="size-3.5" /> : <Save className="size-3.5" />}
                  {savingDoc ? "Saving..." : "Save as Document"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!task.result?.extraction) return null;

  const { extraction, summary } = task.result;

  const handleApply = async () => {
    setApplying(true);
    const success = await onApply(task.id);
    setApplying(false);
    if (success) {
      onClose();
    }
  };

  const handleDismiss = () => {
    onDismiss(task.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-xl rounded-3xl border border-border bg-card p-6 shadow-2xl max-h-[88vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border/60 pb-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Sparkles className="size-4.5" />
            </div>
            <div>
              <h2 className="font-heading text-base font-semibold">Review AI Changes</h2>
              <p className="text-xs text-muted-foreground">
                {task.title} {task.subtitle ? `· ${task.subtitle}` : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close review dialog"
            className="flex size-8 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Modal Body with Extracted Changes */}
        <div className="mt-4 flex-1 overflow-y-auto space-y-3.5 pr-1 text-xs">
          {/* Summary Box */}
          <div className="rounded-2xl border border-success-border bg-success-surface p-3.5 flex items-start gap-2.5">
            <CheckCircle2 className="size-4 text-success shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-success block">
                {summary || "AI analyzed the job and found updates"}
              </span>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                The following fields will be added or updated when you accept. Existing fields will not be overwritten if the newly extracted values are empty.
              </p>
            </div>
          </div>

          {/* Grid of Extracted Details */}
          <div className="space-y-3 rounded-2xl border border-border/80 bg-muted/20 p-4">
            {extraction.title && (
              <div className="flex items-start gap-2.5">
                <FileText className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">Job Title</span>
                  <span className="font-medium text-foreground text-xs">{extraction.title}</span>
                </div>
              </div>
            )}

            {extraction.company && (
              <div className="flex items-start gap-2.5">
                <Building2 className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">Company</span>
                  <span className="font-medium text-foreground text-xs">{extraction.company}</span>
                </div>
              </div>
            )}

            {(extraction.location || extraction.work_location || extraction.employment_type) && (
              <div className="flex items-start gap-2.5">
                <MapPin className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">Location & Mode</span>
                  <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                    {extraction.location && (
                      <span className="font-medium text-foreground">{extraction.location}</span>
                    )}
                    {extraction.work_location && (
                      <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold text-foreground capitalize">
                        {extraction.work_location}
                      </span>
                    )}
                    {extraction.employment_type && (
                      <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold text-foreground">
                        {extraction.employment_type}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {extraction.salary_range && (
              <div className="flex items-start gap-2.5">
                <Banknote className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">Salary</span>
                  <span className="font-medium text-foreground text-xs">{extraction.salary_range}</span>
                </div>
              </div>
            )}

            {Array.isArray(extraction.skills) && extraction.skills.length > 0 && (
              <div className="flex items-start gap-2.5">
                <Briefcase className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">
                    Skills ({extraction.skills.length})
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {extraction.skills.map((skill, idx) => (
                      <span
                        key={idx}
                        className="rounded-lg bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-medium text-foreground"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {Array.isArray(extraction.benefits) && extraction.benefits.length > 0 && (
              <div className="flex items-start gap-2.5">
                <Gift className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">
                    Benefits ({extraction.benefits.length})
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {extraction.benefits.map((b, idx) => (
                      <span
                        key={idx}
                        className="rounded-lg bg-muted px-2 py-0.5 text-[10px] font-medium text-foreground"
                      >
                        {b}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {extraction.educational_requirements && (
              <div className="flex items-start gap-2.5">
                <GraduationCap className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">Education</span>
                  <span className="font-medium text-foreground text-xs leading-relaxed">
                    {extraction.educational_requirements}
                  </span>
                </div>
              </div>
            )}

            {(extraction.work_schedule || extraction.holiday_policy) && (
              <div className="flex items-start gap-2.5">
                <Calendar className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">Schedule & Policies</span>
                  {extraction.work_schedule && (
                    <p className="text-[11px] text-foreground">
                      <strong className="font-semibold">Schedule:</strong> {extraction.work_schedule}
                    </p>
                  )}
                  {extraction.holiday_policy && (
                    <p className="text-[11px] text-foreground">
                      <strong className="font-semibold">Holiday:</strong> {extraction.holiday_policy}
                    </p>
                  )}
                </div>
              </div>
            )}

            {extraction.contact && (extraction.contact.name || extraction.contact.email) && (
              <div className="flex items-start gap-2.5">
                <UserCheck className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">Recruiter / Contact</span>
                  <span className="font-medium text-foreground text-xs">
                    {extraction.contact.name || "Contact"}{" "}
                    {extraction.contact.email ? `(${extraction.contact.email})` : ""}
                  </span>
                </div>
              </div>
            )}

            {extraction.application_url && (
              <div className="flex items-start gap-2.5">
                <ExternalLink className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">Application Link</span>
                  <a
                    href={extraction.application_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary hover:underline truncate block"
                  >
                    {extraction.application_url}
                  </a>
                </div>
              </div>
            )}

            {extraction.description && (
              <div className="pt-1 border-t border-border/60">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">
                  Description Preview
                </span>
                <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-4 bg-muted/40 p-2.5 rounded-xl">
                  {extraction.description}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="mt-4 border-t border-border/60 pt-3 flex items-center justify-between gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDismiss}
            className="rounded-xl text-xs text-muted-foreground hover:text-destructive hover:border-destructive/40 cursor-pointer"
          >
            Dismiss Task
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="rounded-xl text-xs cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={applying}
              onClick={handleApply}
              className="rounded-xl text-xs gap-1.5 cursor-pointer bg-primary text-primary-foreground font-semibold"
            >
              {applying ? <Spinner className="size-3.5" /> : <Check className="size-3.5" />}
              {applying ? "Applying..." : "Accept & Apply Changes"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
