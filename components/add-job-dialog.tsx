"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createJob } from "@/lib/actions/jobs";
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
import { Plus, UserRound, CalendarClock, Calendar, HelpCircle, Hourglass } from "lucide-react";
import { XIcon } from "@/components/ui/x";
import { ZapIcon } from "@/components/ui/zap";
import { toast } from "sonner";
import type { ExtractionResult } from "@/lib/ai/schema";
import type { BoardList } from "@/lib/types/board";
import { JobNotesEditor, type JobNote } from "@/components/job-notes-editor";
import { cn, generateUUID } from "@/lib/utils";

const employmentTypes = [
  "Full-time",
  "Part-time",
  "Contract",
  "Freelance",
  "Internship",
  "Temporary",
  "Apprenticeship",
  "Volunteer",
];

const statusOptions = [
  { value: "saved", label: "Wishlist" },
  { value: "applied", label: "Applied" },
  { value: "screening", label: "Screening" },
  { value: "interviewing", label: "Interviewing" },
  { value: "offered", label: "Offered" },
  { value: "rejected", label: "Rejected" },
];

interface AddJobDialogProps {
  initialData?: ExtractionResult;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Board column to drop the new job into. Omitted => createJob falls back to Wishlist. */
  listId?: string;
  /** User's board lists, for the section-deadline target picker. */
  lists?: BoardList[];
}

type DeadlineMode = "unknown" | "asap" | "date" | "milestone";

export function AddJobDialog({
  initialData,
  trigger,
  open: controlledOpen,
  onOpenChange,
  listId,
  lists = [],
}: AddJobDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [pending, setPending] = useState(false);
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [company, setCompany] = useState(initialData?.company ?? "");
  const [deadlineMode, setDeadlineMode] = useState<DeadlineMode | null>(
    initialData?.deadline ? "date" : null
  );
  const [applicationDeadline, setApplicationDeadline] = useState(initialData?.deadline ?? "");
  const [sectionDeadline, setSectionDeadline] = useState("");
  const [milestoneDate, setMilestoneDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState<JobNote[]>(
    initialData?.notes?.map((n) => ({
      id: generateUUID(),
      title: n.title,
      bullets: n.bullets,
    })) ?? []
  );
  const [workLocation, setWorkLocation] = useState(initialData?.work_location ?? "");
  const [employmentType, setEmploymentType] = useState(initialData?.employment_type ?? "Full-time");
  const [tier, setTier] = useState<string>("none");
  const [status, setStatus] = useState("saved");
  const [contact, setContact] = useState(initialData?.contact ?? null);
  const [skills, setSkills] = useState<string[]>(initialData?.skills ?? []);
  const [benefits, setBenefits] = useState<string[]>(initialData?.benefits ?? []);
  const [isUnpaid, setIsUnpaid] = useState<boolean>(Boolean(initialData?.is_unpaid));
  const [salaryCurrency, setSalaryCurrency] = useState<string>(initialData?.salary_currency ?? "USD");
  const [salaryPeriod, setSalaryPeriod] = useState<string>(initialData?.salary_period ?? "yearly");
  const [mapUrl, setMapUrl] = useState<string>(initialData?.map_url ?? "");
  const [sectionDeadlineListId, setSectionDeadlineListId] = useState<string>("__none__");
  const router = useRouter();

  const isDeadlineSelected =
    deadlineMode === "unknown" ||
    deadlineMode === "asap" ||
    (deadlineMode === "date" && (Boolean(applicationDeadline.trim()) || Boolean(sectionDeadline.trim()))) ||
    (deadlineMode === "milestone" && Boolean(milestoneDate.trim()));

  const canSubmit = Boolean(title.trim()) && Boolean(company.trim()) && isDeadlineSelected;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit) {
      toast.error("Please fill required fields and select a deadline / milestone");
      return;
    }
    setPending(true);

    const formData = new FormData(e.currentTarget);
    formData.append("notes", JSON.stringify(notes));
    formData.append("work_location", workLocation);
    formData.append("employment_type", employmentType);
    formData.append("tier", tier === "none" ? "" : tier);
    formData.append("status", status);
    formData.append("skills", JSON.stringify(skills));
    formData.append("benefits", JSON.stringify(benefits));
    formData.append("is_unpaid", isUnpaid ? "true" : "false");
    formData.append("salary_currency", salaryCurrency);
    formData.append("salary_period", salaryPeriod);
    formData.append("map_url", mapUrl);
    formData.append("deadline_mode", deadlineMode || "");
    if (deadlineMode === "date") {
      formData.append("deadline", applicationDeadline);
      formData.append("section_deadline", sectionDeadline);
    } else if (deadlineMode === "milestone") {
      formData.append("milestone_name", "Applied & Waiting");
      formData.append("milestone_date", milestoneDate);
    }
    formData.append(
      "section_deadline_list_id",
      sectionDeadlineListId === "__none__" ? "" : sectionDeadlineListId
    );

    if (listId) formData.append("list_id", listId);
    if (contact?.name || contact?.email) {
      if (contact.name) formData.append("contact_name", contact.name);
      if (contact.email) formData.append("contact_email", contact.email);
      if (contact.role) formData.append("contact_role", contact.role);
    }
    try {
      const result = await createJob(formData);
      setOpen(false);
      setNotes([]);
      setSkills([]);
      setBenefits([]);
      setIsUnpaid(false);
      setMapUrl("");
      setWorkLocation("");
      setEmploymentType("Full-time");
      setTier("none");
      setStatus("saved");
      setContact(null);
      setDeadlineMode(null);
      setApplicationDeadline("");
      setSectionDeadline("");
      setSectionDeadlineListId("__none__");
      // Opened from the board: stay on the board instead of navigating away.
      if (result?.jobId && !listId) {
        router.push("/jobs/" + result.jobId);
      } else {
        router.refresh();
      }
    } catch (err) {
      console.error("Failed to create job:", err);
      toast.error(err instanceof Error ? err.message : "Couldn't save job");
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      {trigger ? (
        <span onClick={() => setOpen(true)}>{trigger}</span>
      ) : controlledOpen === undefined ? (
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="mr-1 size-4" />
          Add Job
        </Button>
      ) : null}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-lg font-semibold">Add Job</h2>
              <button
                onClick={() => setOpen(false)}
                className="flex size-8 items-center justify-center rounded-2xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <XIcon className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Job title *</Label>
                <Input
                  id="title"
                  name="title"
                  required
                  placeholder="e.g. Senior Frontend Engineer"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Company *</Label>
                <Input
                  id="company"
                  name="company"
                  required
                  placeholder="e.g. Acme Technologies"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="application_url">Job URL</Label>
                <Input
                  id="application_url"
                  name="application_url"
                  type="url"
                  placeholder="https://..."
                  defaultValue={initialData?.application_url ?? ""}
                  className="h-10"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="application_email">Application email</Label>
                  <Input
                    id="application_email"
                    name="application_email"
                    type="email"
                    placeholder="careers@example.com"
                    defaultValue={initialData?.application_email ?? ""}
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="application_process">Application instructions</Label>
                  <Input
                    id="application_process"
                    name="application_process"
                    placeholder="e.g. Send resume with subject..."
                    defaultValue={initialData?.application_process ?? ""}
                    className="h-10"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    name="location"
                    placeholder="e.g. San Francisco, CA"
                    defaultValue={initialData?.location ?? ""}
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="salary_range">Salary range</Label>
                  <Input
                    id="salary_range"
                    name="salary_range"
                    placeholder="e.g. $150k - $200k"
                    defaultValue={initialData?.salary_range ?? ""}
                    className="h-10"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="employment_type">Employment type</Label>
                  <Select value={employmentType} onValueChange={(v) => setEmploymentType(v ?? "Full-time")}>
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {employmentTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="work_location">Work location</Label>
                  <Select value={workLocation} onValueChange={(v) => setWorkLocation(v ?? "")}>
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="remote">Remote</SelectItem>
                      <SelectItem value="onsite">Onsite</SelectItem>
                      <SelectItem value="hybrid">Hybrid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Priority Tier</Label>
                  <Select value={tier} onValueChange={(v) => setTier(v ?? "none")}>
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue placeholder="Select tier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No tier</SelectItem>
                      <SelectItem value="1">Tier 1 (Top)</SelectItem>
                      <SelectItem value="2">Tier 2 (Second)</SelectItem>
                      <SelectItem value="3">Tier 3 (Third)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v ?? "saved")}>
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Deadlines & Milestones Section — Mandatory */}
              <div
                className={cn(
                  "rounded-2xl border p-4 space-y-3 transition-colors",
                  !deadlineMode ? "border-amber-500/40 bg-amber-500/5" : "border-border bg-muted/20"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                    <CalendarClock className="size-3.5 text-primary" />
                    Deadline / Milestone <span className="text-destructive font-bold">*</span>
                  </span>
                  {!deadlineMode ? (
                    <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full animate-pulse">
                      Selection required
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                      Selected
                    </span>
                  )}
                </div>

                {/* 4 Quick Selector Buttons */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setDeadlineMode("unknown")}
                    className={cn(
                      "flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all cursor-pointer",
                      deadlineMode === "unknown"
                        ? "border-primary bg-primary/10 text-primary font-semibold shadow-xs ring-1 ring-primary/30"
                        : "border-border bg-background hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <HelpCircle className="size-4 mb-1 text-muted-foreground" />
                    <span className="text-xs font-medium">Unknown</span>
                    <span className="text-[10px] text-muted-foreground leading-tight mt-0.5">No deadline info</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeadlineMode("asap")}
                    className={cn(
                      "flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all cursor-pointer",
                      deadlineMode === "asap"
                        ? "border-rose-500 bg-rose-500/15 text-rose-600 dark:text-rose-400 font-semibold shadow-xs ring-1 ring-rose-500/30"
                        : "border-border bg-background hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <ZapIcon className="size-4 mb-1 text-rose-500" />
                    <span className="text-xs font-medium">ASAP</span>
                    <span className="text-[10px] text-muted-foreground leading-tight mt-0.5">Apply immediately</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeadlineMode("date")}
                    className={cn(
                      "flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all cursor-pointer",
                      deadlineMode === "date"
                        ? "border-primary bg-primary/10 text-primary font-semibold shadow-xs ring-1 ring-primary/30"
                        : "border-border bg-background hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Calendar className="size-4 mb-1 text-primary" />
                    <span className="text-xs font-medium">Exact Date</span>
                    <span className="text-[10px] text-muted-foreground leading-tight mt-0.5">Specific deadline</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeadlineMode("milestone")}
                    className={cn(
                      "flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all cursor-pointer",
                      deadlineMode === "milestone"
                        ? "border-purple-500 bg-purple-500/15 text-purple-600 dark:text-purple-400 font-semibold shadow-xs ring-1 ring-purple-500/30"
                        : "border-border bg-background hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Hourglass className="size-4 mb-1 text-purple-500" />
                    <span className="text-xs font-medium">Milestone</span>
                    <span className="text-[10px] text-muted-foreground leading-tight mt-0.5">Elapsed waiting</span>
                  </button>
                </div>

                {/* Explanatory notes & Date Inputs */}
                {deadlineMode === "unknown" && (
                  <p className="text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-lg border border-border/50">
                    ℹ️ Marked as <strong>Unknown</strong>. There is no known deadline yet. It will show a neutral badge and can be edited anytime.
                  </p>
                )}

                {deadlineMode === "asap" && (
                  <p className="text-xs text-rose-700 dark:text-rose-300 bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/20">
                    ⚡ Marked as <strong>Apply ASAP</strong>. No formal deadline, but urgent application needed.
                  </p>
                )}

                {deadlineMode === "date" && (
                  <div className="space-y-3 pt-2 border-t border-border/40">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="deadline" className="text-xs font-medium">
                          Application Deadline <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="deadline"
                          name="deadline"
                          type="date"
                          value={applicationDeadline}
                          onChange={(e) => setApplicationDeadline(e.target.value)}
                          className="h-9 text-xs"
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="section_deadline" className="text-xs font-medium">Section Target Deadline</Label>
                        <Input
                          id="section_deadline"
                          name="section_deadline"
                          type="date"
                          value={sectionDeadline}
                          onChange={(e) => setSectionDeadline(e.target.value)}
                          className="h-9 text-xs"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="section_deadline_list_id" className="text-xs font-medium">Target Section for Deadline</Label>
                      <Select value={sectionDeadlineListId} onValueChange={(v) => setSectionDeadlineListId(v ?? "__none__")}>
                        <SelectTrigger className="h-9 w-full text-xs">
                          <SelectValue placeholder="None (Optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">None (Optional)</SelectItem>
                          {lists.map((list) => (
                            <SelectItem key={list.id} value={list.id}>
                              {list.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {deadlineMode === "milestone" && (
                  <div className="space-y-2 pt-2 border-t border-border/40">
                    <div className="space-y-1.5">
                      <Label htmlFor="milestone_date" className="text-xs font-medium">
                        Milestone Start Date (Applied &amp; Waiting) <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="milestone_date"
                        name="milestone_date"
                        type="date"
                        value={milestoneDate}
                        onChange={(e) => setMilestoneDate(e.target.value)}
                        className="h-9 text-xs"
                        required
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      ⏳ Tracks elapsed waiting days (e.g. &ldquo;3 days waiting&rdquo;) without overdue alarms.
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  rows={4}
                  placeholder="Paste the full job posting here..."
                  defaultValue={initialData?.description ?? ""}
                />
              </div>

              {contact && (contact.name || contact.email) && (
                <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  <UserRound className="size-3.5 shrink-0" />
                  <span className="flex-1 truncate">
                    Found a contact: <span className="font-medium text-foreground">{contact.name ?? contact.email}</span>
                    {contact.name && contact.email ? ` (${contact.email})` : null} — saved to your CRM
                  </span>
                  <button
                    type="button"
                    onClick={() => setContact(null)}
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    <XIcon className="size-3.5" />
                  </button>
                </div>
              )}

              <JobNotesEditor notes={notes} onChange={setNotes} />

              <div className="flex items-center justify-between pt-2">
                {!canSubmit ? (
                  <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                    ⚠️ {!title.trim() || !company.trim() ? "Title & Company required" : "Select a deadline option"}
                  </span>
                ) : <span />}
                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={!canSubmit || pending}>
                    {pending ? <Spinner className="mr-2" /> : null}
                    Save job
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
