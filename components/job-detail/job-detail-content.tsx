"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, Building2, MoveRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
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
  const band = matchScoreBand(job.match_score);
  const statusColor = { saved: "#94A3B8", interested: "#3B82F6", preparing: "#F59E0B" }[
    job.status as JobStatus
  ] ?? "#94A3B8";

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card/60 px-6 py-3.5 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted/80">
              <Building2 className="size-4 text-muted-foreground/70" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-bold tracking-tight">{job.title}</h1>
              <p className="truncate text-xs text-muted-foreground">
                {company?.name ?? "Unknown company"}
                {company?.location && <span className="text-muted-foreground/50"> · {company.location}</span>}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span
              className="rounded-lg px-2 py-0.5 text-[11px] font-medium"
              style={{ backgroundColor: `${statusColor}20`, color: statusColor }}
            >
              {JOB_STATUS_LABELS[job.status as JobStatus] ?? job.status}
            </span>
            {band && (
              <span className={`rounded-lg px-2 py-0.5 text-[11px] font-medium tabular-nums ${band.className}`}>
                {band.label} {Math.round(job.match_score!)}
              </span>
            )}
            {job.application_url && (
              <a
                href={job.application_url}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "outline", size: "sm", className: "h-7 gap-1 px-2.5 text-xs" })}
              >
                Apply now
                <ExternalLink className="size-3" />
              </a>
            )}
            {lists && onMoveTo && (
              <MoveToMenu
                lists={lists}
                currentListId={job.list_id}
                onMoveTo={onMoveTo}
                renderTrigger={<button className={buttonVariants({ variant: "outline", size: "sm", className: "h-7 text-xs" })} />}
              >
                <MoveRight className="mr-1 size-3" />
                Move
              </MoveToMenu>
            )}
            {!lists && (
              <Link href="/jobs" className={buttonVariants({ variant: "ghost", size: "sm", className: "h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground" })}>
                Back to jobs
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Tabs + Shortcuts */}
      <div className="grid flex-1 gap-5 p-5 lg:grid-cols-[1fr_250px]">
        <Tabs value={tab} onValueChange={(v) => setTab(v ?? "insights")}>
          <TabsList variant="line" className="mb-3.5 h-8 w-full justify-start overflow-x-auto gap-0.5 text-xs">
            <TabsTrigger value="insights">Insights</TabsTrigger>
            <TabsTrigger value="deadlines">Deadlines</TabsTrigger>
            <TabsTrigger value="edit">Edit</TabsTrigger>
            <TabsTrigger value="ai-tools">AI Tools</TabsTrigger>
            <TabsTrigger value="activities">Activities</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
            <TabsTrigger value="contacts">Contacts</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="company">Company</TabsTrigger>
          </TabsList>

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
        </Tabs>

        <ShortcutsPanel
          data={data}
          onRefresh={onRefresh}
          onJumpToTab={(t) => setTab(t)}
        />
      </div>
    </div>
  );
}
