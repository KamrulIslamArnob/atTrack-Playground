"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createContact,
  getContacts,
  linkContact,
  unlinkContact,
  type Contact,
} from "@/lib/actions/contacts";
import { CONTACT_ROLES, contactRoleLabel } from "@/lib/types/contacts";
import type { JobDetailData } from "@/lib/types/job-detail";
import { getContactAvatarColorClass, cn } from "@/lib/utils";
import { Mail, Phone, Plus, Trash2, UserRound, X } from "lucide-react";

interface ContactsTabProps {
  data: JobDetailData;
  onRefresh: () => void;
}

export function ContactsTab({ data, onRefresh }: ContactsTabProps) {
  const { contacts } = data;
  const [creating, setCreating] = useState(false);
  const [newRole, setNewRole] = useState("other");
  const [linking, setLinking] = useState(false);
  const [library, setLibrary] = useState<Contact[] | null>(null);
  const [pending, setPending] = useState(false);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPending(true);
    try {
      const formData = new FormData(e.currentTarget);
      formData.append("role", newRole);
      await createContact(data.job.id, formData);
      setCreating(false);
      setNewRole("other");
      onRefresh();
    } catch {
      toast.error("Could not create contact");
    } finally {
      setPending(false);
    }
  };

  const openLinkPicker = async () => {
    setLinking(true);
    const all = await getContacts();
    setLibrary(all);
  };

  const handleLink = async (contactId: string) => {
    try {
      await linkContact(data.job.id, contactId);
      setLinking(false);
      onRefresh();
    } catch {
      toast.error("Could not link contact");
    }
  };

  const handleUnlink = async (contactId: string) => {
    try {
      await unlinkContact(data.job.id, contactId);
      onRefresh();
    } catch {
      toast.error("Could not remove contact");
    }
  };

  const linkedIds = new Set(contacts.map((c) => c.id));
  const pickable = (library ?? []).filter((c) => !linkedIds.has(c.id));

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => setCreating((v) => !v)}>
          <Plus className="mr-1 size-3.5" />
          Create contact
        </Button>
        <Button type="button" variant="outline" size="sm" className="flex-1" onClick={openLinkPicker}>
          <UserRound className="mr-1 size-3.5" />
          Link contact
        </Button>
      </div>

      {creating && (
        <form onSubmit={handleCreate} className="space-y-3 rounded-2xl border border-border p-3">
          <Input name="name" required placeholder="Name *" className="h-9" />
          <div className="grid grid-cols-2 gap-2">
            <Input name="email" type="email" placeholder="Email" className="h-9" />
            <Input name="phone" placeholder="Phone" className="h-9" />
          </div>
          <Select value={newRole} onValueChange={(v) => setNewRole(v ?? "other")}>
            <SelectTrigger className="h-9 w-full">
              <SelectValue>{contactRoleLabel(newRole)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {CONTACT_ROLES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea name="notes" placeholder="Notes (optional)" rows={2} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              {pending && <Spinner className="mr-1" />}
              Create
            </Button>
          </div>
        </form>
      )}

      {linking && (
        <div className="rounded-2xl border border-border p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Pick a contact to link</p>
            <button onClick={() => setLinking(false)} className="text-muted-foreground hover:text-foreground">
              <X className="size-3.5" />
            </button>
          </div>
          {library === null ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : pickable.length === 0 ? (
            <p className="text-xs text-muted-foreground">No other contacts in your library yet.</p>
          ) : (
            <div className="space-y-1">
              {pickable.map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleLink(c.id)}
                  className="flex w-full items-center justify-between rounded-2xl px-2 py-1.5 text-left text-sm hover:bg-muted"
                >
                  <span className="flex items-center gap-2">
                    {c.avatar_url ? (
                      <img src={c.avatar_url} alt={c.name} className="size-5 rounded-full object-cover" />
                    ) : (
                      <span className={cn("flex size-5 items-center justify-center rounded-full text-[10px] font-bold", getContactAvatarColorClass(c.role, c.name))}>
                        {(c.name.trim()[0] || "C").toUpperCase()}
                      </span>
                    )}
                    {c.name}
                  </span>
                  <span className="text-xs text-muted-foreground">{contactRoleLabel(c.role)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        {contacts.map((c) => (
          <div key={c.id} className="rounded-2xl border border-border p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2.5 min-w-0">
                {c.avatar_url ? (
                  <img
                    src={c.avatar_url}
                    alt={c.name}
                    className="size-8 shrink-0 rounded-full object-cover shadow-xs border border-border mt-0.5"
                  />
                ) : (
                  <div
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold shadow-xs mt-0.5",
                      getContactAvatarColorClass(c.role, c.name)
                    )}
                  >
                    {(c.name.trim()[0] || "C").toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{contactRoleLabel(c.role)}</p>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    {c.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="size-3" /> {c.email}
                      </span>
                    )}
                    {c.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="size-3" /> {c.phone}
                      </span>
                    )}
                  </div>
                  {c.notes && <p className="mt-1 text-xs text-muted-foreground">{c.notes}</p>}
                </div>
              </div>
              <button
                onClick={() => handleUnlink(c.id)}
                className="flex size-7 shrink-0 items-center justify-center rounded-2xl text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </div>
        ))}
        {contacts.length === 0 && <p className="text-xs text-muted-foreground">No contacts linked to this job yet.</p>}
      </div>
    </div>
  );
}
