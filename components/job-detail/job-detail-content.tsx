"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, Building2, MoveRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MoveToMenu } from "@/components/board/move-to-menu";
import { ShortcutsPanel } from "@/components/job-detail/shortcuts-panel";
import { InsightsTab } from "@/components/job-detail/tabs/insights-tab";
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
      <div className="border-b border-border p-6 pr-14">
        <div className="flex items-start gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-muted">
            <Building2 className="size-6 text-muted-foreground/50" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold tracking-tight">{job.title}</h1>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {company?.name ?? "Unknown company"}
              {company?.location && <span className="text-muted-foreground/50"> · {company.location}</span>}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span
            className="rounded-2xl px-2.5 py-1 text-xs font-medium"
            style={{ backgroundColor: `${statusColor}20`, color: statusColor }}
          >
            {JOB_STATUS_LABELS[job.status as JobStatus] ?? job.status}
          </span>
          {band && (
            <span className={`rounded-2xl px-2.5 py-1 text-xs font-medium tabular-nums ${band.className}`}>
              {band.label} {Math.round(job.match_score!)}
            </span>
          )}
          {job.application_url && (
            <a
              href={job.application_url}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline", size: "sm", className: "gap-1.5" })}
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
              renderTrigger={<button className={buttonVariants({ variant: "outline", size: "sm" })} />}
            >
              <MoveRight className="mr-1 size-3.5" />
              Move
            </MoveToMenu>
          )}
          {!lists && (
            <Link href="/jobs" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Back to jobs
            </Link>
          )}
        </div>
      </div>

      {/* Tabs + Shortcuts */}
      <div className="grid flex-1 gap-6 p-6 lg:grid-cols-[1fr_260px]">
        <Tabs value={tab} onValueChange={(v) => setTab(v ?? "insights")}>
          <TabsList variant="line" className="mb-4 w-full justify-start overflow-x-auto">
            <TabsTrigger value="insights">Insights</TabsTrigger>
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
