"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ExternalLink,
  Building2,
  MoveRight,
  ChevronDown,
  Copy,
  Check,
  Sparkles,
  Calendar,
  Pencil,
  Bot,
  FileText,
  Users,
  Folder,
} from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MoveToMenu } from "@/components/board/move-to-menu";
import { InsightsTab } from "@/components/job-detail/tabs/insights-tab";
import { DeadlinesTab } from "@/components/job-detail/tabs/deadlines-tab";
import { EditTab } from "@/components/job-detail/tabs/edit-tab";
import { AiToolsTab } from "@/components/job-detail/tabs/ai-tools-tab";
import { NotesTab } from "@/components/job-detail/tabs/notes-tab";
import { ContactsTab } from "@/components/job-detail/tabs/contacts-tab";
import { DocumentsTab } from "@/components/job-detail/tabs/documents-tab";
import { CompanyTab } from "@/components/job-detail/tabs/company-tab";
import { JOB_STATUS_LABELS, type JobStatus } from "@/lib/types/job";
import { matchScoreBand, type BoardList } from "@/lib/types/board";
import type { JobDetailData } from "@/lib/types/job-detail";
import { cn } from "@/lib/utils";

const TAB_ITEMS = [
  { id: "insights", label: "Insights", icon: Sparkles, color: "text-lime-500" },
  { id: "deadlines", label: "Deadlines", icon: Calendar, color: "text-amber-500" },
  { id: "edit", label: "Edit", icon: Pencil, color: "text-blue-500" },
  { id: "ai-tools", label: "AI Tools", icon: Bot, color: "text-purple-500" },
  { id: "notes", label: "Notes", icon: FileText, color: "text-sky-500" },
  { id: "contacts", label: "Contacts", icon: Users, color: "text-indigo-500" },
  { id: "documents", label: "Documents", icon: Folder, color: "text-orange-500" },
  { id: "company", label: "Company", icon: Building2, color: "text-pink-500" },
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
  const [tab, setTab] = useState("insights");
  const [copied, setCopied] = useState(false);
  const band = matchScoreBand(job.match_score);
  const scoreBandKey = job.match_score === null ? null : job.match_score >= 80 ? "strong" : job.match_score >= 50 ? "fair" : "weak";
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

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Status Chip - Pushable 3D Badge */}
            <span className="pushable-badge pushable-status">
              <span className="pushable-shadow" />
              <span className="pushable-edge" />
              <span className="pushable-front">
                {JOB_STATUS_LABELS[job.status as JobStatus] ?? job.status}
              </span>
            </span>

            {/* Match Score Chip - Pushable 3D Badge */}
            {band && scoreBandKey && (
              <span className={`pushable-badge pushable-match-${scoreBandKey}`}>
                <span className="pushable-shadow" />
                <span className="pushable-edge" />
                <span className="pushable-front">
                  {band.label} {Math.round(job.match_score!)}
                </span>
              </span>
            )}

            {/* Apply Now Button - Pushable 3D Royal Blue Button */}
            {job.application_url && (
              <a
                href={job.application_url}
                target="_blank"
                rel="noopener noreferrer"
                className="pushable-apply"
              >
                <span className="pushable-shadow" />
                <span className="pushable-edge" />
                <span className="pushable-front">
                  <span>Apply now</span>
                  <ExternalLink className="size-3.5" />
                </span>
              </a>
            )}

            {/* Move Dropdown Trigger - Pushable 3D Purple Button (Uiverse.io by PriyanshuGupta28) */}
            {lists && onMoveTo && (
              <MoveToMenu
                lists={lists}
                currentListId={job.list_id}
                onMoveTo={onMoveTo}
                renderTrigger={
                  <button className="pushable-move" />
                }
              >
                <span className="pushable-shadow" />
                <span className="pushable-edge" />
                <span className="pushable-front">
                  <MoveRight className="size-3.5" />
                  <span>Move</span>
                  <ChevronDown className="size-3 opacity-90" />
                </span>
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

      {/* Main Tabs Content - Full Width */}
      <div className="flex-1 min-w-0 max-w-full p-4 sm:p-5 flex flex-col">
        <Tabs value={tab} onValueChange={(v) => setTab(v ?? "insights")} className="min-w-0 w-full overflow-hidden flex flex-col">
          <TabsList className="radio-inputs-header h-auto shrink-0">
            {TAB_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <TabsTrigger
                  key={item.id}
                  value={item.id}
                  className="radio-tab-trigger"
                >
                  <Icon className={cn("size-3.5 transition-transform", item.color)} />
                  <span>{item.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          <div className="radio-tabs-content-box min-w-0 flex-1">
            <div className="radio-tabs-content-inner">
              <TabsContent value="insights" className="radio-tab-content-panel mt-0">
                <InsightsTab data={data} onRefresh={onRefresh} />
              </TabsContent>
              <TabsContent value="deadlines" className="radio-tab-content-panel mt-0">
                <DeadlinesTab data={data} onRefresh={onRefresh} />
              </TabsContent>
              <TabsContent value="edit" className="radio-tab-content-panel mt-0">
                <EditTab data={data} companyName={company?.name ?? null} onRefresh={onRefresh} />
              </TabsContent>
              <TabsContent value="ai-tools" className="radio-tab-content-panel mt-0">
                <AiToolsTab data={data} companyName={company?.name ?? null} onRefresh={onRefresh} />
              </TabsContent>
              <TabsContent value="notes" className="radio-tab-content-panel mt-0">
                <NotesTab data={data} onRefresh={onRefresh} />
              </TabsContent>
              <TabsContent value="contacts" className="radio-tab-content-panel mt-0">
                <ContactsTab data={data} onRefresh={onRefresh} />
              </TabsContent>
              <TabsContent value="documents" className="radio-tab-content-panel mt-0">
                <DocumentsTab data={data} onRefresh={onRefresh} />
              </TabsContent>
              <TabsContent value="company" className="radio-tab-content-panel mt-0">
                <CompanyTab data={data} onRefresh={onRefresh} />
              </TabsContent>
            </div>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
