"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { updateJob } from "@/lib/actions/jobs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { TagInput } from "@/components/ui/tag-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MapPin, GraduationCap, Gift, Calendar, Building2 } from "lucide-react";
import { DollarSignIcon } from "@/components/ui/dollar-sign";
import { SparklesIcon } from "@/components/ui/sparkles";
import { ClockIcon } from "@/components/ui/clock";
import { ExternalLinkIcon } from "@/components/ui/external-link";
import type { JobDetailData } from "@/lib/types/job-detail";
import { DISCOVERY_CHANNELS } from "@/lib/types/job";

interface EditTabProps {
  data: JobDetailData;
  companyName: string | null;
  onRefresh: () => void;
  /**
   * Fires the first time anything in the form is touched, so the slide-over can
   * guard against closing on unsaved edits without lifting every field's state.
   * It's a one-way touched flag: typing and then undoing still reads as dirty.
   */
  onDirtyChange?: (dirty: boolean) => void;
  /** Called after a successful save, so the slide-over can close itself. */
  onSaved?: () => void;
}

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

const currencies = [
  { label: "USD ($)", value: "USD" },
  { label: "BDT (৳)", value: "BDT" },
  { label: "EUR (€)", value: "EUR" },
  { label: "GBP (£)", value: "GBP" },
  { label: "CAD ($)", value: "CAD" },
  { label: "AUD ($)", value: "AUD" },
];

export function EditTab({ data, companyName, onRefresh, onDirtyChange, onSaved }: EditTabProps) {
  const { job } = data;
  const [pending, setPending] = useState(false);
  const dirty = useRef(false);

  const markDirty = () => {
    if (dirty.current) return;
    dirty.current = true;
    onDirtyChange?.(true);
  };

  const [workLocation, setWorkLocation] = useState(job.work_location ?? "");
  const [employmentType, setEmploymentType] = useState(job.employment_type ?? "Full-time");
  const [tier, setTier] = useState<string>(job.tier ?? "none");
  const [discoveryChannel, setDiscoveryChannel] = useState<string>(job.discovery_channel ?? "none");

  // Rich structured attributes
  const [skills, setSkills] = useState<string[]>(job.skills ?? []);
  const [benefits, setBenefits] = useState<string[]>(job.benefits ?? []);
  const [isUnpaid, setIsUnpaid] = useState<boolean>(Boolean(job.is_unpaid));
  const [salaryCurrency, setSalaryCurrency] = useState<string>(job.salary_currency ?? "USD");
  const [salaryPeriod, setSalaryPeriod] = useState<string>(job.salary_period ?? "yearly");
  const [mapUrl, setMapUrl] = useState<string>(job.map_url ?? "");

  const handleOpenGoogleMaps = () => {
    const query = job.location || companyName || "Job Location";
    const googleUrl = mapUrl.trim() || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    window.open(googleUrl, "_blank", "noopener,noreferrer");
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPending(true);
    try {
      const formData = new FormData(e.currentTarget);
      formData.append("job_id", job.id);
      formData.append("work_location", workLocation);
      formData.append("employment_type", employmentType);
      formData.append("tier", tier === "none" ? "" : tier);
      formData.append("discovery_channel", discoveryChannel === "none" ? "" : discoveryChannel);
      formData.append("skills", JSON.stringify(skills));
      formData.append("benefits", JSON.stringify(benefits));
      formData.append("is_unpaid", isUnpaid ? "true" : "false");
      formData.append("salary_currency", salaryCurrency);
      formData.append("salary_period", salaryPeriod);
      formData.append("map_url", mapUrl);

      await updateJob(formData);
      dirty.current = false;
      onDirtyChange?.(false);
      onRefresh();
      toast.success("Job details saved");
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update job");
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} onInput={markDirty} className="space-y-6">
      {/* Basic Job Details */}
      <div className="space-y-4 rounded-2xl border border-border bg-card/60 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          Job Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Job title *</Label>
            <Input id="title" name="title" required defaultValue={job.title} className="h-9 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="company">Company *</Label>
            <Input id="company" name="company" required defaultValue={companyName ?? ""} className="h-9 text-xs" />
          </div>
        </div>

        {/* Company profile fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-border/60 pt-3">
          <div className="space-y-1.5">
            <Label htmlFor="company_website">Company website</Label>
            <Input
              id="company_website"
              name="company_website"
              type="url"
              defaultValue={data.company?.website ?? ""}
              className="h-9 text-xs"
              placeholder="https://company.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="company_location">Company location / HQ</Label>
            <Input
              id="company_location"
              name="company_location"
              defaultValue={data.company?.location ?? ""}
              className="h-9 text-xs"
              placeholder="e.g. San Francisco, CA"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="company_type">Company type</Label>
            <Input
              id="company_type"
              name="company_type"
              defaultValue={data.company?.company_type ?? ""}
              className="h-9 text-xs"
              placeholder="e.g. Private / Enterprise / Startup"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="company_founded_year">Founded year</Label>
            <Input
              id="company_founded_year"
              name="company_founded_year"
              type="number"
              defaultValue={data.company?.founded_year ?? ""}
              className="h-9 text-xs"
              placeholder="e.g. 2015"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="company_country">Country</Label>
            <Input
              id="company_country"
              name="company_country"
              defaultValue={data.company?.country ?? ""}
              className="h-9 text-xs"
              placeholder="e.g. United States"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-border/60 pt-3">
          <div className="space-y-1.5">
            <Label htmlFor="application_url">Job URL</Label>
            <Input id="application_url" name="application_url" type="url" defaultValue={job.application_url ?? ""} className="h-9 text-xs" placeholder="https://..." />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="application_email">Application email</Label>
            <Input id="application_email" name="application_email" type="email" defaultValue={job.application_email ?? ""} className="h-9 text-xs" placeholder="careers@example.com" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="application_process">How to apply</Label>
            <Input id="application_process" name="application_process" defaultValue={job.application_process ?? ""} className="h-9 text-xs" placeholder="e.g. Email resume to HR" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <Label>Priority Tier</Label>
            <Select
              value={tier}
              onValueChange={(v) => {
                setTier(v ?? "none");
                markDirty();
              }}
            >
              <SelectTrigger className="h-9 text-xs w-full">
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
          <div className="space-y-1.5">
            <Label>Employment type</Label>
            <Select
              value={employmentType}
              onValueChange={(v) => {
                setEmploymentType(v ?? "Full-time");
                markDirty();
              }}
            >
              <SelectTrigger className="h-9 text-xs w-full">
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
          <div className="space-y-1.5">
            <Label>Work location</Label>
            <Select
              value={workLocation}
              onValueChange={(v) => {
                setWorkLocation(v ?? "");
                markDirty();
              }}
            >
              <SelectTrigger className="h-9 text-xs w-full">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="remote">Remote</SelectItem>
                <SelectItem value="onsite">Onsite</SelectItem>
                <SelectItem value="hybrid">Hybrid</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="source">Source</Label>
            <Input id="source" name="source" defaultValue={job.source ?? ""} className="h-9 text-xs" placeholder="e.g. LinkedIn, Company Portal" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-border/60 pt-3">
          <div className="space-y-1.5">
            <Label htmlFor="discovery_channel">How you found it</Label>
            <Select
              value={discoveryChannel}
              onValueChange={(v) => {
                setDiscoveryChannel(v ?? "none");
                markDirty();
              }}
            >
              <SelectTrigger className="h-9 text-xs w-full">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not set</SelectItem>
                {DISCOVERY_CHANNELS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="source_url">Source link</Label>
            <Input
              id="source_url"
              name="source_url"
              type="url"
              defaultValue={job.source_url ?? ""}
              className="h-9 text-xs"
              placeholder="Link to the post or listing that tipped you off"
            />
          </div>
        </div>
      </div>

      {/* Location & Map URL */}
      <div className="space-y-4 rounded-2xl border border-border bg-card/60 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <MapPin className="size-3.5 text-cyan-500" /> Location & Map
          </h3>
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={handleOpenGoogleMaps}
            className="gap-1 text-[11px] h-6"
          >
            <ExternalLinkIcon className="size-3 text-cyan-500" /> View on Google Maps
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="location">Workplace Location</Label>
            <Input id="location" name="location" defaultValue={job.location ?? ""} className="h-9 text-xs" placeholder="e.g. Uttara, Dhaka" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="map_url">Google Map Link / Coords</Label>
            <Input
              id="map_url"
              name="map_url"
              value={mapUrl}
              onChange={(e) => setMapUrl(e.target.value)}
              className="h-9 text-xs"
              placeholder="https://maps.google.com/?q=..."
            />
          </div>
        </div>
      </div>

      {/* Salary & Compensation */}
      <div className="space-y-4 rounded-2xl border border-border bg-card/60 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <DollarSignIcon className="size-3.5 text-emerald-500" /> Salary & Compensation
          </h3>
          <label className="flex items-center gap-2 text-xs font-medium cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isUnpaid}
              onChange={(e) => {
                setIsUnpaid(e.target.checked);
                markDirty();
              }}
              className="rounded border-border size-4 text-primary focus:ring-primary"
            />
            <span>Unpaid / Volunteer Position</span>
          </label>
        </div>

        {!isUnpaid && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="salary_min">Min Salary</Label>
              <Input
                id="salary_min"
                name="salary_min"
                type="number"
                step="any"
                defaultValue={job.salary_min ?? ""}
                className="h-9 text-xs"
                placeholder="e.g. 50000"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="salary_max">Max Salary</Label>
              <Input
                id="salary_max"
                name="salary_max"
                type="number"
                step="any"
                defaultValue={job.salary_max ?? ""}
                className="h-9 text-xs"
                placeholder="e.g. 80000"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select
                value={salaryCurrency}
                onValueChange={(v) => {
                  setSalaryCurrency(v ?? "USD");
                  markDirty();
                }}
              >
                <SelectTrigger className="h-9 text-xs w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Frequency</Label>
              <Select
                value={salaryPeriod}
                onValueChange={(v) => {
                  setSalaryPeriod(v ?? "yearly");
                  markDirty();
                }}
              >
                <SelectTrigger className="h-9 text-xs w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yearly">Per Year</SelectItem>
                  <SelectItem value="monthly">Per Month</SelectItem>
                  <SelectItem value="hourly">Per Hour</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="salary_range">Display Salary Range Label</Label>
          <Input
            id="salary_range"
            name="salary_range"
            defaultValue={isUnpaid ? "Unpaid Internship" : job.salary_range ?? ""}
            className="h-9 text-xs"
            placeholder="e.g. $50,000 - $80,000 / yr"
          />
        </div>
      </div>

      {/* Structured Requirements & Perks */}
      <div className="space-y-4 rounded-2xl border border-border bg-card/60 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <SparklesIcon className="size-3.5 text-indigo-500" /> Requirements, Skills & Perks
        </h3>

        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-xs font-medium">
            <SparklesIcon className="size-3 text-cyan-500" /> Required Tech Skills (Tags)
          </Label>
          <TagInput
            tags={skills}
            onChange={(next) => {
              setSkills(next);
              markDirty();
            }}
            placeholder="Type skill keyword (e.g. Node.js, React, Docker) and press Enter..."
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="educational_requirements" className="flex items-center gap-1.5 text-xs font-medium">
            <GraduationCap className="size-3 text-amber-500" /> Educational Requirements
          </Label>
          <Input
            id="educational_requirements"
            name="educational_requirements"
            defaultValue={job.educational_requirements ?? ""}
            className="h-9 text-xs"
            placeholder="e.g. Bachelor degree in CSE, Software Engineering or equivalent experience"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-xs font-medium">
            <Gift className="size-3 text-pink-500" /> Benefits & What We Offer (Tags)
          </Label>
          <TagInput
            tags={benefits}
            onChange={(next) => {
              setBenefits(next);
              markDirty();
            }}
            placeholder="Type benefit (e.g. Subsidized Lunch, Mentorship, Unlimited Tea) and press Enter..."
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="work_schedule" className="flex items-center gap-1.5 text-xs font-medium">
              <ClockIcon className="size-3 text-blue-500" /> Schedule & Working Hours
            </Label>
            <Input
              id="work_schedule"
              name="work_schedule"
              defaultValue={job.work_schedule ?? ""}
              className="h-9 text-xs"
              placeholder="e.g. 09:00 AM to 6:00 PM, Mon-Fri"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="holiday_policy" className="flex items-center gap-1.5 text-xs font-medium">
              <Calendar className="size-3 text-emerald-500" /> Holiday & Leave Policy
            </Label>
            <Input
              id="holiday_policy"
              name="holiday_policy"
              defaultValue={job.holiday_policy ?? ""}
              className="h-9 text-xs"
              placeholder="e.g. Weekly holiday: Saturday, Sunday"
            />
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Full Job Description</Label>
        <Textarea
          id="description"
          name="description"
          rows={5}
          defaultValue={job.description ?? ""}
          className="text-xs leading-relaxed"
          placeholder="Paste full job posting text..."
        />
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending && <Spinner className="mr-2" />}
          Save changes
        </Button>
      </div>
    </form>
  );
}
