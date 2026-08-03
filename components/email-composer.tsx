"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { streamGenerateEmail, parseEmailFromStream, type EmailGenerationParams } from "@/lib/ai/email";
import { sendApplicationEmail } from "@/lib/actions/email";
import { ArrowLeft, RefreshCw, Copy, Check, Loader2, FileText, Paperclip, Send, Pencil } from "lucide-react";

interface Resume {
  id: string;
  name: string;
  content: string | null;
  isDefault: boolean;
}

interface EmailComposerProps {
  job: {
    id: string;
    title: string;
    company: string;
    description: string | null;
    applicationProcess: string | null;
    applicationEmail: string;
  };
  applicant: {
    name: string;
    headline: string | null;
  };
  resumes: Resume[];
  defaultResumeId: string | null;
}

export function EmailComposer({ job, applicant, resumes, defaultResumeId }: EmailComposerProps) {
  const router = useRouter();
  const [selectedResumeId, setSelectedResumeId] = useState<string>(defaultResumeId ?? "");
  const [isStreaming, setIsStreaming] = useState(false);
  const [rawStream, setRawStream] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const streamRef = useRef("");

  const selectedResume = resumes.find((r) => r.id === selectedResumeId) ?? null;

  const generateEmail = useCallback(async (resumeId: string) => {
    const resume = resumes.find((r) => r.id === resumeId);

    setIsStreaming(true);
    setIsReady(false);
    setSubject("");
    setBody("");
    setRawStream("");
    setIsEditing(false);
    streamRef.current = "";

    const params: EmailGenerationParams = {
      jobTitle: job.title,
      companyName: job.company,
      jobDescription: job.description,
      applicationProcess: job.applicationProcess,
      applicantName: applicant.name,
      applicantHeadline: applicant.headline,
      resumeContent: resume?.content ?? null,
    };

    try {
      for await (const chunk of streamGenerateEmail(params)) {
        streamRef.current += chunk;
        setRawStream(streamRef.current);

        const partial = parseEmailFromStream(streamRef.current);
        if (partial) {
          setSubject(partial.subject);
          setBody(partial.body);
        }
      }

      const final = parseEmailFromStream(streamRef.current);
      if (final) {
        setSubject(final.subject);
        setBody(final.body);
        setIsReady(true);
      } else {
        toast.error("Failed to generate email. Please try again.");
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        toast.info("Generation cancelled.");
      } else {
        toast.error("Failed to generate email.");
        console.error(err);
      }
    } finally {
      setIsStreaming(false);
    }
  }, [job, applicant, resumes]);

  // Auto-generate on mount
  useEffect(() => {
    generateEmail(selectedResumeId);
    return () => abortRef.current?.abort();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleResumeChange = (resumeId: string | null) => {
    if (!resumeId) return;
    setSelectedResumeId(resumeId);
    generateEmail(resumeId);
  };

  const handleCopy = () => {
    const attachmentNote = selectedResume ? `\n\n[Attachment: ${selectedResume.name}]` : "";
    const fullEmail = `Subject: ${subject}\n\n${body}${attachmentNote}`;
    navigator.clipboard.writeText(fullEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Email copied to clipboard.");
  };

  const handleCopySubject = () => {
    navigator.clipboard.writeText(subject);
    toast.success("Subject copied.");
  };

  const handleSend = async () => {
    setShowConfirm(false);
    setIsSending(true);

    const result = await sendApplicationEmail({
      to: job.applicationEmail,
      subject,
      body,
      resumeId: selectedResumeId || null,
    });

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Email sent successfully!", {
        description: `Sent to ${job.applicationEmail}`,
      });
    }

    setIsSending(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to job
        </button>
        <div className="flex items-center gap-2">
          {!isStreaming && (
            <Button variant="outline" size="sm" onClick={() => generateEmail(selectedResumeId)} className="gap-1.5">
              <RefreshCw className="size-3.5" />
              Regenerate
            </Button>
          )}
          {isReady && (
            <Button size="sm" onClick={handleCopy} className="gap-1.5">
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "Copied" : "Copy email"}
            </Button>
          )}
          {isReady && (
            <Button size="sm" onClick={() => setShowConfirm(true)} disabled={isSending} className="gap-1.5">
              {isSending ? <Spinner className="size-3.5" /> : <Send className="size-3.5" />}
              {isSending ? "Sending..." : "Send"}
            </Button>
          )}
        </div>
      </div>

      {/* Recipient info + Resume selector */}
      <div className="rounded-4xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">To:</span>{" "}
              <span className="font-medium">{job.applicationEmail}</span>
            </div>
            <div className="text-muted-foreground/40">|</div>
            <div>
              <span className="text-muted-foreground">Re:</span>{" "}
              <span className="font-medium">{job.title} at {job.company}</span>
            </div>
          </div>
          {resumes.length > 0 && (
            <div className="flex items-center gap-2 shrink-0">
              <Paperclip className="size-3.5 text-muted-foreground" />
              <Select
                value={selectedResumeId}
                onValueChange={handleResumeChange}
                items={resumes.map((r) => ({ value: r.id, label: r.name }))}
              >
                <SelectTrigger className="h-9 w-[200px]">
                  <SelectValue placeholder="Select resume..." />
                </SelectTrigger>
                <SelectContent>
                  {resumes.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      <span className="flex items-center gap-1.5">
                        <FileText className="size-3.5 shrink-0" />
                        {r.name}
                        {r.isDefault && <span className="text-[10px] text-muted-foreground">(default)</span>}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      {/* Subject */}
      <div className="space-y-2">
        <Label>Subject</Label>
        <div className="flex items-center gap-2">
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="h-10"
            readOnly={!isReady && !isEditing}
          />
          {isReady && (
            <Button variant="outline" size="sm" onClick={handleCopySubject} className="shrink-0">
              Copy
            </Button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Email body</Label>
          {isReady && !isEditing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="gap-1.5"
            >
              <Pencil className="size-3.5" />
              Edit
            </Button>
          )}
        </div>

        {isStreaming && !isReady ? (
          <div className="relative min-h-[300px] rounded-4xl border border-border bg-card p-4">
            <div className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-foreground/90">
              {rawStream ? (
                <>
                  {rawStream}
                  <span className="inline-block size-2 animate-pulse rounded-full bg-primary ml-0.5" />
                </>
              ) : (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Writing your email...
                </div>
              )}
            </div>
            <div className="absolute bottom-3 right-3">
              <Spinner className="size-4 text-muted-foreground" />
            </div>
          </div>
        ) : isEditing ? (
          <div className="space-y-3">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              className="font-mono text-sm leading-relaxed"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                Done
              </Button>
            </div>
          </div>
        ) : body ? (
          <div className="min-h-[300px] rounded-4xl border border-border bg-card p-4">
            <div className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-foreground/90">
              {body}
            </div>
          </div>
        ) : null}
      </div>

      {/* Attachment + spam note */}
      {isReady && (
        <div className="space-y-3">
          {selectedResume && (
            <div className="flex items-center gap-3 rounded-4xl border border-border bg-card p-4">
              <div className="flex size-10 items-center justify-center rounded-4xl bg-muted">
                <Paperclip className="size-5 text-muted-foreground/50" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Resume to attach</p>
                <p className="text-sm font-medium truncate">{selectedResume.name}</p>
              </div>
              <span className="rounded-4xl bg-primary/10 px-2.5 py-1 text-[10px] font-medium text-primary">
                Will be attached
              </span>
            </div>
          )}
          <div className="rounded-4xl bg-muted/50 p-4 text-xs text-muted-foreground">
            <strong>Spam-safe:</strong> This email uses plain text formatting, avoids spam trigger words,
            and follows professional email conventions to maximize deliverability.
          </div>
        </div>
      )}

      {/* Confirmation dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-4xl border border-border bg-card p-6 shadow-md">
            <h2 className="font-heading text-lg font-semibold">Send email?</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">To</span>
                <span className="font-medium">{job.applicationEmail}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Subject</span>
                <span className="font-medium truncate max-w-[250px]">{subject}</span>
              </div>
              {selectedResume && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Attachment</span>
                  <span className="font-medium">{selectedResume.name}</span>
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowConfirm(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSend} disabled={isSending} className="gap-1.5">
                {isSending ? <Spinner className="size-3.5" /> : <Send className="size-3.5" />}
                {isSending ? "Sending..." : "Send email"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
