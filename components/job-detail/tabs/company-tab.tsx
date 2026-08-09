"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { updateCompany } from "@/lib/actions/companies";
import type { JobDetailData } from "@/lib/types/job-detail";

interface CompanyTabProps {
  data: JobDetailData;
  onRefresh: () => void;
}

export function CompanyTab({ data, onRefresh }: CompanyTabProps) {
  const { company } = data;
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);

  if (!company) {
    return <p className="text-sm text-muted-foreground">No company on this job.</p>;
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPending(true);
    try {
      await updateCompany(company.id, new FormData(e.currentTarget));
      setEditing(false);
      onRefresh();
      toast.success("Company updated");
    } catch {
      toast.error("Could not update company");
    } finally {
      setPending(false);
    }
  };

  if (editing) {
    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="website">Website</Label>
          <Input id="website" name="website" type="url" defaultValue={company.website ?? ""} placeholder="https://..." className="h-10" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input id="location" name="location" defaultValue={company.location ?? ""} placeholder="e.g. San Francisco, CA" className="h-10" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="founded_year">Founded</Label>
            <Input id="founded_year" name="founded_year" type="number" defaultValue={company.founded_year ?? ""} placeholder="e.g. 2010" className="h-10" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company_type">Type</Label>
            <Input id="company_type" name="company_type" defaultValue={company.company_type ?? ""} placeholder="e.g. Private" className="h-10" />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="country">Country</Label>
          <Input id="country" name="country" defaultValue={company.country ?? ""} placeholder="e.g. United States" className="h-10" />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(false)}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={pending}>
            {pending && <Spinner className="mr-2" />}
            Save
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-muted">
          <Building2 className="size-6 text-muted-foreground/50" />
        </div>
        <div>
          {company.website ? (
            <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:underline">
              {company.name}
            </a>
          ) : (
            <p className="text-sm font-medium">{company.name}</p>
          )}
          {company.location && <p className="text-xs text-muted-foreground">{company.location}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Founded</p>
          <p className="font-medium">{company.founded_year ?? "Not specified"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Type</p>
          <p className="font-medium">{company.company_type ?? "Not specified"}</p>
        </div>
        <div className="col-span-2">
          <p className="text-xs text-muted-foreground">Country</p>
          <p className="font-medium">{company.country ?? "Not specified"}</p>
        </div>
      </div>

      <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
        Edit company
      </Button>
    </div>
  );
}
