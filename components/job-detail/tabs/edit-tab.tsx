"use client";

import { useState } from "react";
import { toast } from "sonner";
import { updateJob } from "@/lib/actions/jobs";
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
import type { JobDetailData } from "@/lib/types/job-detail";

interface EditTabProps {
  data: JobDetailData;
  companyName: string | null;
  onRefresh: () => void;
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

const statusOptions = [
  { value: "saved", label: "Saved" },
  { value: "interested", label: "Interested" },
  { value: "preparing", label: "Preparing" },
];

export function EditTab({ data, companyName, onRefresh }: EditTabProps) {
  const { job } = data;
  const [pending, setPending] = useState(false);
  const [workLocation, setWorkLocation] = useState(job.work_location ?? "");
  const [employmentType, setEmploymentType] = useState(job.employment_type ?? "Full-time");
  const [status, setStatus] = useState(job.status ?? "saved");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPending(true);
    try {
      const formData = new FormData(e.currentTarget);
      formData.append("job_id", job.id);
      formData.append("work_location", workLocation);
      formData.append("employment_type", employmentType);
      formData.append("status", status);
      await updateJob(formData);
      onRefresh();
      toast.success("Job updated");
    } catch {
      toast.error("Could not update job");
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      <div className="space-y-2">
        <Label htmlFor="title">Job title *</Label>
        <Input id="title" name="title" required defaultValue={job.title} className="h-10" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="company">Company *</Label>
        <Input id="company" name="company" required defaultValue={companyName ?? ""} className="h-10" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="application_url">Job URL</Label>
        <Input id="application_url" name="application_url" type="url" defaultValue={job.application_url ?? ""} className="h-10" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="application_email">Application email</Label>
          <Input id="application_email" name="application_email" type="email" defaultValue={job.application_email ?? ""} className="h-10" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="application_process">How to apply</Label>
          <Input id="application_process" name="application_process" defaultValue={job.application_process ?? ""} className="h-10" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input id="location" name="location" defaultValue={job.location ?? ""} className="h-10" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="salary_range">Salary range</Label>
          <Input id="salary_range" name="salary_range" defaultValue={job.salary_range ?? ""} className="h-10" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Employment type</Label>
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
          <Label>Work location</Label>
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
        <div className="space-y-2">
          <Label htmlFor="deadline">Deadline</Label>
          <Input id="deadline" name="deadline" type="date" defaultValue={job.deadline ?? ""} className="h-10" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="source">Source</Label>
        <Input id="source" name="source" defaultValue={job.source ?? ""} className="h-10" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Job description</Label>
        <Textarea id="description" name="description" rows={4} defaultValue={job.description ?? ""} />
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
