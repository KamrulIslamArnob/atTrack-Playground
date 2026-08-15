"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ExternalLink,
  Building2,
  MoveRight,
  ChevronDown,
  ArrowLeft,
  Copy,
  Sparkles,
  CalendarClock,
  Bot,
  Users,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MoveToMenu } from "@/components/board/move-to-menu";
import { OverviewTab } from "@/components/job-detail/tabs/overview-tab";
import { DeadlinesTab } from "@/components/job-detail/tabs/deadlines-tab";
import { AiToolsTab } from "@/components/job-detail/tabs/ai-tools-tab";
import { NetworkTab } from "@/components/job-detail/tabs/network-tab";
import { EditDrawer } from "@/components/job-detail/edit-drawer";
import { CompanyEditDialog } from "@/components/job-detail/company-edit-dialog";
import { JOB_STATUS_LABELS, type JobStatus, type JobState } from "@/lib/types/job";
import { updateJobState, deleteJobWithSmartCascade } from "@/lib/actions/jobs";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { matchScoreBand, type BoardList } from "@/lib/types/board";
import type { JobDetailData } from "@/lib/types/job-detail";
import { cn } from "@/lib/utils";

const TAB_ITEMS = [
  { id: "overview", label: "Overview", icon: Sparkles },
  { id: "timeline", label: "Timeline", icon: CalendarClock },
  { id: "ai-studio", label: "AI studio", icon: Bot },
  { id: "network", label: "Network", icon: Users },
];

interface JobDetailContentProps {
  data: JobDetailData;
  onRefresh: () => void;
  /** Board context only — omitted on the standalone /jobs/[id] page. */
  lists?: BoardList[];
  onMoveTo?: (listId: string) => void;
}

export function JobDetailContent({ data, onRefresh, lists, onMoveTo }: JobDetailContentProps) {
  const { job, company } = data;
  const [tab, setTab] = useState("overview");
  const [editOpen, setEditOpen] = useState(false);
  const [companyOpen, setCompanyOpen] = useState(false);
  const { confirm, dialog } = useConfirm();
  const band = matchScoreBand(job.match_score);

  const handleCopyJson = async () => {
    try {
      const jsonString = JSON.stringify(data, null, 2);
      await navigator.clipboard.writeText(jsonString);
      toast.success("Job details copied as JSON");
    } catch (err) {
      console.error("Failed to copy job details:", err);
      toast.error("Couldn't copy job details");
    }
  };

  const handleDeleteJob = async () => {
    if (!company) return;
    const confirmed = await confirm({
      title: "Delete this job?",
      description: `"${job.title}" will be permanently deleted. If it's the only job for ${company.name}, that company and any unshared contacts and documents go with it. This can't be undone.`,
      confirmText: "Delete job",
      variant: "destructive",
    });
    if (!confirmed) return;
    try {
      const res = await deleteJobWithSmartCascade(job.id);
      toast.success(res.companyDeleted ? "Job and company deleted" : "Job deleted");
      onRefresh();
    } catch {
      toast.error("Couldn't delete job");
    }
  };

  const handleStateChange = async (newState: JobState) => {
    if (job.state === newState) return;
    try {
      await updateJobState(job.id, newState);
      const labelMap: Record<JobState, string> = {
        active: "Active",
        on_hold: "On Hold",
        archived: "Archived",
      };
      toast.success(`Job state changed to ${labelMap[newState]}`);
      onRefresh();
    } catch (err) {
      console.error("Failed to update job state:", err);
      toast.error("Couldn't update job state");
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card/60 px-4 sm:px-6 py-3.5 backdrop-blur-sm pr-14 sm:pr-16 md:pr-20">
        <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {/* The company initial identifies the job faster than a generic glyph. */}
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-brand-tint text-sm font-semibold text-primary">
              {company?.name ? (
                company.name.charAt(0).toUpperCase()
              ) : (
                <Building2 className="size-4 text-muted-foreground/70" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <h1 className="truncate text-sm sm:text-base font-bold tracking-tight max-w-[180px] sm:max-w-xs md:max-w-sm lg:max-w-md">
                  {job.title}
                </h1>
              </div>
              <p className="truncate text-xs text-muted-foreground max-w-[180px] sm:max-w-xs md:max-w-sm">
                {company?.website ? (
                  <a
                    href={company.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary hover:underline"
                  >
                    {company.name}
                  </a>
                ) : (
                  (company?.name ?? "Unknown company")
                )}
                {company?.location && <span className="text-muted-foreground/50"> · {company.location}</span>}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Two flat chips: where the job sits, and how well it fits. */}
            <span className="rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px] font-semibold text-secondary-foreground">
              {JOB_STATUS_LABELS[job.status as JobStatus] ?? job.status}
            </span>

            {band && (
              <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", band.className)}>
                {band.label} fit {Math.round(job.match_score!)}%
              </span>
            )}

            {job.application_url && (
              <Button
                size="sm"
                // Renders an <a>, so base-ui must not assert native button semantics.
                nativeButton={false}
                render={
                  <a href={job.application_url} target="_blank" rel="noopener noreferrer">
                    Apply now
                    <ExternalLink className="size-3.5" />
                  </a>
                }
              />
            )}

            {/* State Change Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" size="sm" className="text-xs">
                    <span>
                      State:{" "}
                      {job.state
                        ? job.state === "on_hold"
                          ? "On Hold"
                          : job.state.charAt(0).toUpperCase() + job.state.slice(1)
                        : "Active"}
                    </span>
                    <ChevronDown className="size-3 opacity-70" />
                  </Button>
                }
              />

              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  disabled={!job.state || job.state === "active"}
                  onClick={() => handleStateChange("active")}
                >
                  🟢 Active
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={job.state === "on_hold"}
                  onClick={() => handleStateChange("on_hold")}
                >
                  ⏸️ On Hold
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={job.state === "archived"}
                  onClick={() => handleStateChange("archived")}
                >
                  📦 Archive
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {lists && onMoveTo && (
              <MoveToMenu
                lists={lists}
                currentListId={job.list_id}
                onMoveTo={onMoveTo}
                renderTrigger={<Button variant="outline" size="sm" className="text-xs" />}
              >
                <MoveRight className="size-3.5" />
                <span>Move</span>
                <ChevronDown className="size-3 opacity-70" />
              </MoveToMenu>
            )}

            {!lists && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                nativeButton={false}
                render={<Link href="/jobs" />}
              >
                Back to jobs
                <ArrowLeft className="size-3.5" />
              </Button>
            )}

            {/* Rare and destructive actions live here, away from the tab strip. */}
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="More job actions"
                render={<Button variant="outline" size="icon-sm" />}
              >
                <MoreHorizontal className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {company && (
                  <DropdownMenuItem onClick={() => setCompanyOpen(true)}>
                    <Building2 className="mr-2 size-3.5" />
                    Edit company
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleCopyJson}>
                  <Copy className="mr-2 size-3.5" />
                  Copy details as JSON
                </DropdownMenuItem>
                {company && (
                  <DropdownMenuItem onClick={handleDeleteJob} className="text-destructive">
                    <Trash2 className="mr-2 size-3.5" />
                    Delete job
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Four domains, one underlined strip — no legacy .radio-* decoration. */}
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v ?? "overview")}
        className="flex min-w-0 flex-1 flex-col gap-0 overflow-hidden"
      >
        <div className="shrink-0 border-b border-border bg-card/40 px-4 sm:px-5">
          <TabsList
            variant="line"
            className="mx-auto max-w-full gap-1 overflow-x-auto p-0 [scrollbar-width:none]"
          >
            {TAB_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <TabsTrigger
                  key={item.id}
                  value={item.id}
                  className="shrink-0 gap-1.5 px-3 py-2.5 text-xs font-semibold group-data-horizontal/tabs:after:bottom-0 data-active:text-primary data-active:after:bg-primary"
                >
                  <Icon className="size-3.5" />
                  <span>{item.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        <div className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-5">
          <TabsContent value="overview">
            <OverviewTab data={data} onRefresh={onRefresh} onEditJob={() => setEditOpen(true)} />
          </TabsContent>
          <TabsContent value="timeline">
            <DeadlinesTab data={data} onRefresh={onRefresh} />
          </TabsContent>
          <TabsContent value="ai-studio">
            <AiToolsTab data={data} companyName={company?.name ?? null} onRefresh={onRefresh} />
          </TabsContent>
          <TabsContent value="network">
            <NetworkTab data={data} onRefresh={onRefresh} />
          </TabsContent>
        </div>
      </Tabs>

      <EditDrawer
        data={data}
        companyName={company?.name ?? null}
        open={editOpen}
        onOpenChange={setEditOpen}
        onRefresh={onRefresh}
      />
      {company && (
        <CompanyEditDialog
          company={company}
          open={companyOpen}
          onOpenChange={setCompanyOpen}
          onRefresh={onRefresh}
        />
      )}
      {dialog}
    </div>
  );
}
