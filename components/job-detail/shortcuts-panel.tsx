"use client";

import { useState } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { EmailApplyButton } from "@/components/email-apply-button";
import { PracticeButton } from "@/components/practice-button";
import { AddInterviewDialog } from "@/components/add-interview-dialog";
import { logApplication, logOffer } from "@/lib/actions/board";
import type { JobDetailData } from "@/lib/types/job-detail";
import { CalendarClock, FileText, Send, Sparkles, Trophy } from "lucide-react";

interface ShortcutsPanelProps {
  data: JobDetailData;
  onRefresh: () => void;
  onJumpToTab: (tab: "documents" | "ai-tools") => void;
}

/**
 * Always-visible right panel. "Create Application Packet"/"Create Tailored
 * Resume" from Huntr are deliberately absent (see plan) — Attach Resume and
 * Generate Cover Letter cover the same intent through AtTrack's own model.
 */
export function ShortcutsPanel({ data, onRefresh, onJumpToTab }: ShortcutsPanelProps) {
  const { job, applications, interviews } = data;
  const [pending, setPending] = useState<string | null>(null);

  const handleLogApplication = async () => {
    setPending("application");
    try {
      await logApplication(job.id);
      onRefresh();
      toast.success("Application logged");
    } catch {
      toast.error("Could not log application");
    } finally {
      setPending(null);
    }
  };

  const handleLogOffer = async (status: "offer" | "accepted") => {
    setPending(status);
    try {
      await logOffer(job.id, status);
      onRefresh();
      toast.success(status === "offer" ? "Offer logged" : "Marked as accepted");
    } catch {
      toast.error("Could not update offer status");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Shortcuts</h3>
        <div className="space-y-2">
          <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => onJumpToTab("documents")}>
            <FileText className="mr-2 size-3.5" />
            Attach resume
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => onJumpToTab("ai-tools")}>
            <Sparkles className="mr-2 size-3.5" />
            Generate cover letter
          </Button>
          {job.application_email && (
            <EmailApplyButton jobId={job.id} isSmtpConfigured={data.smtpReady} />
          )}
          <PracticeButton jobId={job.id} />
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={handleLogApplication}
            disabled={pending === "application"}
          >
            {pending === "application" ? <Spinner className="mr-2" /> : <Send className="mr-2 size-3.5" />}
            Log application
          </Button>
          <AddInterviewDialog
            jobs={[{ id: job.id, title: job.title, company_name: data.company?.name ?? "" }]}
            lockedJobId={job.id}
            onCreated={onRefresh}
            trigger={
              <Button variant="outline" size="sm" className="w-full justify-start">
                <CalendarClock className="mr-2 size-3.5" />
                Log interview
              </Button>
            }
          />
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={() => handleLogOffer("offer")}
            disabled={pending === "offer"}
          >
            {pending === "offer" ? <Spinner className="mr-2" /> : <Trophy className="mr-2 size-3.5" />}
            Log offer
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={() => handleLogOffer("accepted")}
            disabled={pending === "accepted"}
          >
            {pending === "accepted" ? <Spinner className="mr-2" /> : <Trophy className="mr-2 size-3.5" />}
            Log accepted
          </Button>
        </div>
      </div>

      {(applications.length > 0 || interviews.length > 0) && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Timeline</h3>
          <div className="space-y-2 text-sm">
            {applications.map((app) => (
              <div key={app.id} className="rounded-2xl border border-border p-2.5">
                <p className="font-medium capitalize">{app.status}</p>
                <p className="text-xs text-muted-foreground">
                  {app.applied_at
                    ? formatDistanceToNow(new Date(app.applied_at), { addSuffix: true })
                    : formatDistanceToNow(new Date(app.created_at), { addSuffix: true })}
                </p>
              </div>
            ))}
            {interviews.map((iv) => (
              <div key={iv.id} className="rounded-2xl border border-border p-2.5">
                <p className="font-medium capitalize">{iv.type ?? "Interview"} — {iv.status}</p>
                {iv.scheduled_at && (
                  <p className="text-xs text-muted-foreground">
                    {new Date(iv.scheduled_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
