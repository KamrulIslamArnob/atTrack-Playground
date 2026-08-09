"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { streamGenerateAiTool, parseEmailFromStream, type GeneratedEmail } from "@/lib/ai/ai-tools";
import { saveAiToolAsDocument, sendAiToolEmail } from "@/lib/actions/ai-tools";
import { AI_TOOL_KINDS, type AiToolKind } from "@/lib/types/ai-tools";
import type { JobDetailData } from "@/lib/types/job-detail";
import { cn } from "@/lib/utils";
import { Mail, Save, Sparkles } from "lucide-react";

interface AiToolsTabProps {
  data: JobDetailData;
  companyName: string | null;
  onRefresh: () => void;
}

const STAGES = ["Application", "Interview", "Offer"] as const;

export function AiToolsTab({ data, companyName, onRefresh }: AiToolsTabProps) {
  const router = useRouter();
  const [kind, setKind] = useState<AiToolKind | null>(null);
  const [context, setContext] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GeneratedEmail | null>(null);
  const [to, setTo] = useState(data.job.application_email ?? "");
  const [savePending, setSavePending] = useState(false);
  const [sendPending, setSendPending] = useState(false);
  const streamRef = useRef("");

  const grouped = useMemo(
    () => STAGES.map((stage) => ({ stage, kinds: AI_TOOL_KINDS.filter((k) => k.stage === stage) })),
    []
  );

  const handleGenerate = async (selected: AiToolKind) => {
    setKind(selected);
    setResult(null);
    setGenerating(true);
    streamRef.current = "";

    try {
      for await (const chunk of streamGenerateAiTool({
        kind: selected,
        jobTitle: data.job.title,
        companyName: companyName ?? "the company",
        jobDescription: data.job.description,
        applicantName: data.applicantName,
        applicantHeadline: data.applicantHeadline,
        resumeContent: data.resumeContent,
        context: context.trim() || null,
      })) {
        streamRef.current += chunk;
        const partial = parseEmailFromStream(streamRef.current);
        if (partial) setResult(partial);
      }
      const final = parseEmailFromStream(streamRef.current);
      if (final) setResult(final);
      else toast.error("Could not parse the generated email");
    } catch {
      toast.error("Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!kind || !result) return;
    setSavePending(true);
    try {
      await saveAiToolAsDocument(data.job.id, kind, result.subject, result.body);
      onRefresh();
      toast.success("Saved as a document");
    } catch {
      toast.error("Could not save document");
    } finally {
      setSavePending(false);
    }
  };

  const handleSend = async () => {
    if (!result || !to.trim()) return;
    if (!data.smtpReady) {
      toast.error("SMTP not configured", {
        description: "Set up your email in Settings to send directly.",
        action: { label: "Go to Settings", onClick: () => router.push("/settings") },
      });
      return;
    }
    setSendPending(true);
    try {
      const res = await sendAiToolEmail(data.job.id, to.trim(), result.subject, result.body);
      if (res.error) throw new Error(res.error);
      onRefresh();
      toast.success("Email sent");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send email");
    } finally {
      setSendPending(false);
    }
  };

  if (kind) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => {
            setKind(null);
            setResult(null);
          }}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← Back to AI Tools
        </button>

        <div className="space-y-2">
          <Label htmlFor="ai-tool-context">Extra context (optional)</Label>
          <Textarea
            id="ai-tool-context"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="e.g. interview was on Tuesday, offer includes $120k base, requesting 1 more week..."
            rows={2}
          />
        </div>

        <Button onClick={() => handleGenerate(kind)} disabled={generating} size="sm">
          {generating && <Spinner className="mr-2" />}
          <Sparkles className="mr-1 size-3.5" />
          {result ? "Regenerate" : "Generate"}
        </Button>

        {result && (
          <div className="space-y-3 rounded-2xl border border-border p-3">
            <div className="space-y-1">
              <Label className="text-xs">Subject</Label>
              <Input
                value={result.subject}
                onChange={(e) => setResult({ ...result, subject: e.target.value })}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Body</Label>
              <Textarea
                value={result.body}
                onChange={(e) => setResult({ ...result, body: e.target.value })}
                rows={10}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Send to</Label>
              <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="recipient@company.com" className="h-9" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={handleSave} disabled={savePending}>
                {savePending ? <Spinner className="mr-2" /> : <Save className="mr-1 size-3.5" />}
                Save as document
              </Button>
              <Button size="sm" onClick={handleSend} disabled={sendPending || !to.trim()}>
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
                  "flex items-center gap-2 rounded-2xl border border-border p-3 text-left text-sm transition-colors hover:bg-muted"
                )}
              >
                <Sparkles className="size-3.5 shrink-0 text-muted-foreground" />
                {k.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
