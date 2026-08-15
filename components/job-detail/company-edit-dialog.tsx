"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { updateCompany } from "@/lib/actions/companies";
import type { JobDetailCompany } from "@/lib/types/job-detail";

interface CompanyEditDialogProps {
  company: JobDetailCompany;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh: () => void;
}

/**
 * The company profile is read on the Overview card; this is the only place it
 * is written. Previously both lived in a Company tab alongside "Delete job".
 */
export function CompanyEditDialog({ company, open, onOpenChange, onRefresh }: CompanyEditDialogProps) {
  const [pending, setPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPending(true);
    try {
      await updateCompany(company.id, new FormData(e.currentTarget));
      onOpenChange(false);
      onRefresh();
      toast.success("Company updated");
    } catch {
      toast.error("Couldn't update company");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit company</DialogTitle>
          <DialogDescription>These details are shared by every job at {company.name}.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              name="website"
              type="url"
              defaultValue={company.website ?? ""}
              placeholder="https://..."
              className="h-9"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              name="location"
              defaultValue={company.location ?? ""}
              placeholder="e.g. San Francisco, CA"
              className="h-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="founded_year">Founded</Label>
              <Input
                id="founded_year"
                name="founded_year"
                type="number"
                defaultValue={company.founded_year ?? ""}
                placeholder="e.g. 2010"
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company_type">Type</Label>
              <Input
                id="company_type"
                name="company_type"
                defaultValue={company.company_type ?? ""}
                placeholder="e.g. Private"
                className="h-9"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="country">Country</Label>
            <Input
              id="country"
              name="country"
              defaultValue={company.country ?? ""}
              placeholder="e.g. United States"
              className="h-9"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              {pending && <Spinner className="mr-2" />}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
