"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { saveAiToolAsDocument } from "@/lib/actions/ai-tools";
import { sendApplicationEmail } from "@/lib/actions/email";
import { AI_TOOL_KINDS, type AiToolKind } from "@/lib/types/ai-tools";
import type { JobDetailData } from "@/lib/types/job-detail";
import { cn } from "@/lib/utils";
import { useAiUnlocked } from "@/lib/hooks/use-ai-unlocked";
import { useAiToolsStore } from "@/lib/stores/ai-tools-store";
import { NoApiKeyOverlay } from "@/components/ai-chatbot/no-api-key-overlay";
import { Mail, Save } from "lucide-react";
import { SparklesIcon } from "@/components/ui/sparkles";

interface AiToolsTabProps {
  data: JobDetailData;
  companyName: string | null;
  onRefresh: () => void;
}

const STAGES = ["Application", "Interview", "Offer"] as const;

export function AiToolsTab({ data, companyName, onRefresh }: AiToolsTabProps) {
  const router = useRouter();
  const { unlocked, checked } = useAiUnlocked();
  const [savePending, setSavePending] = useState(false);
  const [sendPending, setSendPending] = useState(false);

  const jobId = data.job.id;
  const defaultToEmail = data.job.application_email ?? "";

  const rawJobState = useAiToolsStore((state) => state.jobs[jobId]);
  const jobState = useMemo(() => {
    if (rawJobState) return rawJobState;
    return {
      kind: null,
      context: "",
      generating: false,
      result: null,
      to: defaultToEmail,
      error: null,
    };
  }, [rawJobState, defaultToEmail]);

  const setKind = (kind: AiToolKind | null) => useAiToolsStore.getState().setKind(jobId, kind);
  const setContext = (context: string) => useAiToolsStore.getState().setContext(jobId, context);
  const setResult = (result: typeof jobState.result) => useAiToolsStore.getState().setResult(jobId, result);
  const setTo = (to: string) => useAiToolsStore.getState().setTo(jobId, to);
  const resetJob = () => useAiToolsStore.getState().resetJob(jobId);
  const generate = useAiToolsStore((state) => state.generate);

  const grouped = useMemo(
    () => STAGES.map((stage) => ({ stage, kinds: AI_TOOL_KINDS.filter((k) => k.stage === stage) })),
    []
  );

  const handleGenerate = (selected: AiToolKind) => {
    generate({
      jobId,
      kind: selected,
      jobTitle: data.job.title,
      companyName: companyName ?? "the company",
      jobDescription: data.job.description,
      applicantName: data.applicantName,
      applicantHeadline: data.applicantHeadline,
      resumeContent: data.resumeContent,
      context: jobState.context,
    });
  };

  const handleSave = async () => {
    if (!jobState.kind || !jobState.result) return;
    setSavePending(true);
    try {
      await saveAiToolAsDocument(jobId, jobState.kind, jobState.result.subject, jobState.result.body);
      onRefresh();
      toast.success("Saved as a document");
    } catch {
      toast.error("Couldn't save document");
    } finally {
      setSavePending(false);
    }
  };

  const handleSend = async () => {
    if (!jobState.result || !jobState.to.trim()) return;
    if (!data.smtpReady) {
      toast.error("SMTP not configured", {
        description: "Set up your email in Settings to send directly.",
        action: { label: "Go to Settings", onClick: () => router.push("/settings") },
      });
      return;
    }
    setSendPending(true);
    try {
      const res = await sendApplicationEmail({
        jobId,
        to: jobState.to.trim(),
        subject: jobState.result.subject,
        body: jobState.result.body,
        resumeId: null,
      });
      if (res.error) throw new Error(res.error);
      onRefresh();
      toast.success("Email sent");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send email");
    } finally {
      setSendPending(false);
    }
  };

  if (checked && !unlocked) {
    return (
      <div className="relative min-h-[280px]">
        <NoApiKeyOverlay message="Please connect your first API key from settings to enable AI tools for this job." />
      </div>
    );
  }

  if (jobState.kind) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={resetJob}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          ← Back to AI Tools
        </button>

        <div className="space-y-2">
          <Label htmlFor="ai-tool-context">Extra context (optional)</Label>
          <Textarea
            id="ai-tool-context"
            value={jobState.context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="e.g. interview was on Tuesday, offer includes $120k base, requesting 1 more week..."
            rows={2}
          />
        </div>

        <Button
          onClick={() => handleGenerate(jobState.kind!)}
          disabled={jobState.generating}
          size="sm"
          className="cursor-pointer"
        >
          {jobState.generating && <Spinner className="mr-2" />}
          <SparklesIcon className="mr-1 size-3.5" />
          {jobState.result ? "Regenerate" : "Generate"}
        </Button>

        {jobState.generating && !jobState.result && (
          <div className="flex items-center gap-2.5 rounded-2xl border border-border/80 bg-muted/30 p-4 text-xs text-muted-foreground animate-pulse">
            <Spinner className="size-4 text-primary" />
            <span>Generating {jobState.kind.replace(/_/g, " ")} with AI...</span>
          </div>
        )}

        {jobState.result && (
          <div className="space-y-3 rounded-2xl border border-border p-3">
            <div className="space-y-1">
              <Label className="text-xs">Subject</Label>
              <Input
                value={jobState.result.subject}
                onChange={(e) =>
                  setResult({ ...jobState.result!, subject: e.target.value })
                }
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Body</Label>
              <Textarea
                value={jobState.result.body}
                onChange={(e) =>
                  setResult({ ...jobState.result!, body: e.target.value })
                }
                rows={10}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Send to</Label>
              <Input
                value={jobState.to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="recipient@company.com"
                className="h-9"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSave}
                disabled={savePending || jobState.generating}
                className="cursor-pointer"
              >
                {savePending ? <Spinner className="mr-2" /> : <Save className="mr-1 size-3.5" />}
                Save as document
              </Button>
              <Button
                size="sm"
                onClick={handleSend}
                disabled={sendPending || !jobState.to.trim() || jobState.generating}
                className="cursor-pointer"
              >
                {sendPending ? <Spinner className="mr-2" /> : <Mail className="mr-1 size-3.5" />}
                Send
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {grouped.map(({ stage, kinds }) => (
        <div key={stage}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{stage}</h3>
          <div className="grid grid-cols-2 gap-2">
            {kinds.map((k) => (
              <button
                key={k.kind}
                onClick={() => setKind(k.kind)}
                className={cn(
                  "flex items-center gap-2 rounded-2xl border border-border p-3 text-left text-sm transition-colors hover:bg-muted cursor-pointer"
                )}
              >
                <SparklesIcon className="size-3.5 shrink-0 text-muted-foreground" />
                {k.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
