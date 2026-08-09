"use client";

import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import {
  createCompanyContact,
  createPersonContact,
  updateContact,
  type Contact,
} from "@/lib/actions/contacts";
import { getJobsForMention, type JobMentionOption } from "@/lib/actions/jobs-list";
import { insertMentionToken } from "@/lib/mentions";
import type { CrmCompany } from "@/lib/actions/companies";

const NO_COMPANY = "__none__";

interface ContactFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present => edit that contact. Absent => create. */
  contact?: Contact;
  companies: CrmCompany[];
  /** Create-mode only: pins the new contact to this company and hides the picker. */
  lockedCompanyId?: string;
  tagSuggestions: string[];
  onSaved: (contact: Contact) => void;
}

function extractFields(formData: FormData) {
  return {
    name: (formData.get("name") as string)?.trim() ?? "",
    role: (formData.get("role") as string) || null,
    email: (formData.get("email") as string) || null,
    phone: (formData.get("phone") as string) || null,
    position: (formData.get("position") as string) || null,
    linkedin_url: (formData.get("linkedin_url") as string) || null,
    github_url: (formData.get("github_url") as string) || null,
    notes: (formData.get("notes") as string) || null,
  };
}

export function ContactFormDialog({
  open,
  onOpenChange,
  contact,
  companies,
  lockedCompanyId,
  tagSuggestions,
  onSaved,
}: ContactFormDialogProps) {
  const mode = contact ? "edit" : "create";
  const tagListId = useId();
  const [pending, setPending] = useState(false);
  const [companyId, setCompanyId] = useState<string>(contact?.company_id ?? lockedCompanyId ?? NO_COMPANY);
  const [notes, setNotes] = useState(contact?.notes ?? "");
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const [jobOptions, setJobOptions] = useState<JobMentionOption[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset local state whenever a different contact is opened, or the dialog re-opens for "create".
  useEffect(() => {
    if (!open) return;
    setCompanyId(contact?.company_id ?? lockedCompanyId ?? NO_COMPANY);
    setNotes(contact?.notes ?? "");
    setMention(null);
  }, [open, contact, lockedCompanyId]);

  useEffect(() => {
    if (!open) return;
    getJobsForMention().then(setJobOptions);
  }, [open]);

  const companyName = (id: string | null) => companies.find((c) => c.id === id)?.name ?? null;

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setNotes(value);
    const caret = e.target.selectionStart ?? value.length;
    const uptoCaret = value.slice(0, caret);
    const at = uptoCaret.lastIndexOf("@");
    if (at === -1 || /\s/.test(uptoCaret.slice(at + 1))) {
      setMention(null);
    } else {
      setMention({ start: at, query: uptoCaret.slice(at + 1) });
    }
  };

  const pickMentionJob = (job: JobMentionOption) => {
    if (!mention) return;
    const caret = textareaRef.current?.selectionStart ?? notes.length;
    const before = notes.slice(0, mention.start);
    const after = notes.slice(caret);
    const token = insertMentionToken(job.title, job.id);
    const next = `${before}${token} ${after}`;
    setNotes(next);
    setMention(null);
    requestAnimationFrame(() => {
      const pos = (before + token + " ").length;
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(pos, pos);
    });
  };

  const filteredJobs = mention
    ? jobOptions.filter((j) => j.title.toLowerCase().includes(mention.query.toLowerCase())).slice(0, 6)
    : [];

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!(e.currentTarget.elements.namedItem("name") as HTMLInputElement)?.value.trim()) {
      toast.error("Name is required");
      return;
    }
    setPending(true);
    try {
      const formData = new FormData(e.currentTarget);
      const fields = extractFields(formData);
      const resolvedCompanyId = lockedCompanyId ?? (companyId === NO_COMPANY ? null : companyId);

      if (mode === "edit" && contact) {
        formData.set("company_id", resolvedCompanyId ?? "");
        await updateContact(contact.id, formData);
        onSaved({
          ...contact,
          ...fields,
          company_id: resolvedCompanyId,
          company_name: companyName(resolvedCompanyId),
        });
      } else if (lockedCompanyId) {
        const { id } = await createCompanyContact(lockedCompanyId, formData);
        onSaved({
          id,
          ...fields,
          company_id: lockedCompanyId,
          company_name: companyName(lockedCompanyId),
        });
      } else {
        if (resolvedCompanyId) formData.set("company_id", resolvedCompanyId);
        const { id } = await createPersonContact(formData);
        onSaved({
          id,
          ...fields,
          company_id: resolvedCompanyId,
          company_name: companyName(resolvedCompanyId),
        });
      }
      onOpenChange(false);
    } catch {
      toast.error(mode === "edit" ? "Could not update contact" : "Could not create contact");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Edit contact" : "Add contact"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="contact-name">Name *</Label>
              <Input id="contact-name" name="name" required defaultValue={contact?.name ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-email">Email</Label>
              <Input id="contact-email" name="email" type="email" defaultValue={contact?.email ?? ""} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {lockedCompanyId ? (
              <div className="space-y-1.5">
                <Label>Company</Label>
                <p className="flex h-9 items-center text-sm text-muted-foreground">{companyName(lockedCompanyId)}</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Company</Label>
                <Select value={companyId} onValueChange={(v) => setCompanyId(v ?? NO_COMPANY)}>
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder="No company">
                      {companyId === NO_COMPANY ? "No company" : companyName(companyId)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_COMPANY}>No company</SelectItem>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="contact-position">Position</Label>
              <Input id="contact-position" name="position" placeholder="e.g. Software Engineer" defaultValue={contact?.position ?? ""} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="contact-phone">Phone</Label>
              <Input id="contact-phone" name="phone" defaultValue={contact?.phone ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-tag">Tag</Label>
              <Input
                id="contact-tag"
                name="role"
                list={tagListId}
                placeholder="e.g. Alumni, HR, Technical Lead"
                defaultValue={contact?.role ?? ""}
              />
              <datalist id={tagListId}>
                {tagSuggestions.map((tag) => (
                  <option key={tag} value={tag} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="contact-linkedin">LinkedIn</Label>
              <Input id="contact-linkedin" name="linkedin_url" type="url" placeholder="https://linkedin.com/in/…" defaultValue={contact?.linkedin_url ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-github">GitHub</Label>
              <Input id="contact-github" name="github_url" type="url" placeholder="https://github.com/…" defaultValue={contact?.github_url ?? ""} />
            </div>
          </div>

          <div className="relative space-y-1.5">
            <Label htmlFor="contact-notes">Notes</Label>
            <Textarea
              id="contact-notes"
              name="notes"
              ref={textareaRef}
              rows={3}
              placeholder="Type @ to link a saved job…"
              value={notes}
              onChange={handleNotesChange}
            />
            {mention && filteredJobs.length > 0 && (
              <Command className="absolute z-10 mt-1 w-full" value="">
                <CommandList>
                  <CommandGroup heading="Link a job">
                    {filteredJobs.map((job) => (
                      <CommandItem key={job.id} onItemSelect={() => pickMentionJob(job)}>
                        {job.title}
                        {job.company_name ? ` — ${job.company_name}` : ""}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              {pending && <Spinner className="mr-2" />}
              {mode === "edit" ? "Save changes" : "Add contact"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
