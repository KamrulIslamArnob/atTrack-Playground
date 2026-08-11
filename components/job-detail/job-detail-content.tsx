"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, Building2, MoveRight, ChevronDown, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MoveToMenu } from "@/components/board/move-to-menu";
import { ShortcutsPanel } from "@/components/job-detail/shortcuts-panel";
import { InsightsTab } from "@/components/job-detail/tabs/insights-tab";
import { DeadlinesTab } from "@/components/job-detail/tabs/deadlines-tab";
import { EditTab } from "@/components/job-detail/tabs/edit-tab";
import { AiToolsTab } from "@/components/job-detail/tabs/ai-tools-tab";
import { ActivitiesTab } from "@/components/job-detail/tabs/activities-tab";
import { NotesTab } from "@/components/job-detail/tabs/notes-tab";
import { ContactsTab } from "@/components/job-detail/tabs/contacts-tab";
import { DocumentsTab } from "@/components/job-detail/tabs/documents-tab";
import { CompanyTab } from "@/components/job-detail/tabs/company-tab";
import { JOB_STATUS_LABELS, type JobStatus } from "@/lib/types/job";
import { matchScoreBand, type BoardList } from "@/lib/types/board";
import type { JobDetailData } from "@/lib/types/job-detail";

interface JobDetailContentProps {
  data: JobDetailData;
  onRefresh: () => void;
  /** Board context only — omitted on the standalone /jobs/[id] page. */
  lists?: BoardList[];
  onMoveTo?: (listId: string) => void;
}

export function JobDetailContent({ data, onRefresh, lists, onMoveTo }: JobDetailContentProps) {
  const { job, company } = data;
  const [tab, setTab] = useState("insights");
  const [copied, setCopied] = useState(false);
  const band = matchScoreBand(job.match_score);
  const statusColor = { saved: "#94A3B8", interested: "#3B82F6", preparing: "#F59E0B" }[
    job.status as JobStatus
  ] ?? "#94A3B8";

  const handleCopyJson = async () => {
    try {
      const jsonString = JSON.stringify(data, null, 2);
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      toast.success("Job details copied as JSON to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy job details:", err);
      toast.error("Failed to copy job details.");
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card/60 px-4 sm:px-6 py-3.5 backdrop-blur-sm pr-14 sm:pr-16 md:pr-20">
        <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted/80">
              <Building2 className="size-4 text-muted-foreground/70" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <h1 className="truncate text-sm sm:text-base font-bold tracking-tight max-w-[180px] sm:max-w-xs md:max-w-sm lg:max-w-md">
                  {job.title}
                </h1>
                <button
                  type="button"
                  onClick={handleCopyJson}
                  title="Copy job details as JSON"
                  aria-label="Copy job details as JSON"
                  className="inline-flex size-6 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 active:scale-95 transition-all"
                >
                  {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                </button>
              </div>
              <p className="truncate text-xs text-muted-foreground max-w-[180px] sm:max-w-xs md:max-w-sm">
                {company?.name ?? "Unknown company"}
                {company?.location && <span className="text-muted-foreground/50"> · {company.location}</span>}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            {/* Status Chip - Squarish rounded-xl with hover scale */}
            <span
              className="inline-flex items-center justify-center rounded-xl px-3 py-1.5 text-xs font-semibold tracking-wide border shadow-2xs transition-all duration-200 hover:scale-105 hover:shadow-xs cursor-default"
              style={{
                backgroundColor: `${statusColor}18`,
                borderColor: `${statusColor}35`,
                color: statusColor,
              }}
            >
              {JOB_STATUS_LABELS[job.status as JobStatus] ?? job.status}
            </span>

            {/* Match Score Chip - Squarish rounded-xl with hover scale */}
            {band && (
              <span
                className={`inline-flex items-center justify-center rounded-xl px-3 py-1.5 text-xs font-semibold tracking-wide tabular-nums shadow-2xs transition-all duration-200 hover:scale-105 hover:shadow-xs cursor-default ${band.className}`}
              >
                {band.label} {Math.round(job.match_score!)}
              </span>
            )}

            {/* Apply Now Button - Blue-Indigo Gradient with lift hover */}
            {job.application_url && (
              <a
                href={job.application_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center h-8 gap-1.5 px-3.5 text-xs font-semibold text-white rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-2xs hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
              >
                Apply now
                <ExternalLink className="size-3.5" />
              </a>
            )}

            {/* Move Dropdown Trigger - Purple-Violet Gradient with lift hover */}
            {lists && onMoveTo && (
              <MoveToMenu
                lists={lists}
                currentListId={job.list_id}
                onMoveTo={onMoveTo}
                renderTrigger={
                  <button
                    className="inline-flex items-center justify-center h-8 gap-1.5 px-3.5 text-xs font-semibold text-white rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 shadow-2xs hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer"
                  />
                }
              >
                <MoveRight className="size-3.5 text-white/90" />
                <span>Move</span>
                <ChevronDown className="size-3 text-white/80" />
              </MoveToMenu>
            )}

            {!lists && (
              <Link
                href="/jobs"
                className="inline-flex items-center justify-center h-8 px-3.5 text-xs font-semibold text-foreground rounded-xl bg-secondary hover:bg-secondary/80 hover:-translate-y-0.5 transition-all duration-200"
              >
                Back to jobs
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Tabs + Shortcuts Grid - Fully Responsive */}
      <div className="grid flex-1 min-w-0 max-w-full gap-6 p-4 sm:p-5 lg:grid-cols-[1fr_220px] xl:grid-cols-[1fr_250px]">
        <Tabs value={tab} onValueChange={(v) => setTab(v ?? "insights")} className="min-w-0 w-full overflow-hidden flex flex-col">
          <TabsList className="mb-4 flex flex-wrap h-auto w-full justify-start gap-1.5 bg-transparent p-0 text-xs shrink-0">
            <TabsTrigger
              value="insights"
              className="rounded-xl px-3 py-1.5 font-medium border border-border/60 bg-muted/40 text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:font-semibold shadow-2xs hover:bg-muted transition-all cursor-pointer"
            >
              Insights
            </TabsTrigger>
            <TabsTrigger
              value="deadlines"
              className="rounded-xl px-3 py-1.5 font-medium border border-border/60 bg-muted/40 text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:font-semibold shadow-2xs hover:bg-muted transition-all cursor-pointer"
            >
              Deadlines
            </TabsTrigger>
            <TabsTrigger
              value="edit"
              className="rounded-xl px-3 py-1.5 font-medium border border-border/60 bg-muted/40 text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:font-semibold shadow-2xs hover:bg-muted transition-all cursor-pointer"
            >
              Edit
            </TabsTrigger>
            <TabsTrigger
              value="ai-tools"
              className="rounded-xl px-3 py-1.5 font-medium border border-border/60 bg-muted/40 text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:font-semibold shadow-2xs hover:bg-muted transition-all cursor-pointer"
            >
              AI Tools
            </TabsTrigger>
            <TabsTrigger
              value="activities"
              className="rounded-xl px-3 py-1.5 font-medium border border-border/60 bg-muted/40 text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:font-semibold shadow-2xs hover:bg-muted transition-all cursor-pointer"
            >
              Activities
            </TabsTrigger>
            <TabsTrigger
              value="notes"
              className="rounded-xl px-3 py-1.5 font-medium border border-border/60 bg-muted/40 text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:font-semibold shadow-2xs hover:bg-muted transition-all cursor-pointer"
            >
              Notes
            </TabsTrigger>
            <TabsTrigger
              value="contacts"
              className="rounded-xl px-3 py-1.5 font-medium border border-border/60 bg-muted/40 text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:font-semibold shadow-2xs hover:bg-muted transition-all cursor-pointer"
            >
              Contacts
            </TabsTrigger>
            <TabsTrigger
              value="documents"
              className="rounded-xl px-3 py-1.5 font-medium border border-border/60 bg-muted/40 text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:font-semibold shadow-2xs hover:bg-muted transition-all cursor-pointer"
            >
              Documents
            </TabsTrigger>
            <TabsTrigger
              value="company"
              className="rounded-xl px-3 py-1.5 font-medium border border-border/60 bg-muted/40 text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:font-semibold shadow-2xs hover:bg-muted transition-all cursor-pointer"
            >
              Company
            </TabsTrigger>
          </TabsList>

          <div className="min-w-0 flex-1">
            <TabsContent value="insights">
              <InsightsTab data={data} />
            </TabsContent>
            <TabsContent value="deadlines">
              <DeadlinesTab data={data} onRefresh={onRefresh} />
            </TabsContent>
            <TabsContent value="edit">
              <EditTab data={data} companyName={company?.name ?? null} onRefresh={onRefresh} />
            </TabsContent>
            <TabsContent value="ai-tools">
              <AiToolsTab data={data} companyName={company?.name ?? null} onRefresh={onRefresh} />
            </TabsContent>
            <TabsContent value="activities">
              <ActivitiesTab data={data} onRefresh={onRefresh} />
            </TabsContent>
            <TabsContent value="notes">
              <NotesTab data={data} onRefresh={onRefresh} />
            </TabsContent>
            <TabsContent value="contacts">
              <ContactsTab data={data} onRefresh={onRefresh} />
            </TabsContent>
            <TabsContent value="documents">
              <DocumentsTab data={data} onRefresh={onRefresh} />
            </TabsContent>
            <TabsContent value="company">
              <CompanyTab data={data} onRefresh={onRefresh} />
            </TabsContent>
          </div>
        </Tabs>

        <div className="min-w-0 shrink-0 border-t border-border/80 pt-5 lg:border-t-0 lg:pt-0">
          <ShortcutsPanel
            data={data}
            onRefresh={onRefresh}
            onJumpToTab={(t) => setTab(t)}
          />
        </div>
      </div>
    </div>
  );
}
