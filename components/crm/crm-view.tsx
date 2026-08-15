"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  createCompanyContact,
  deleteContact,
  deleteTag,
  getCompanyContacts,
  getOrphanContacts,
  renameTag,
  setContactCompany,
  updateContact,
  type Contact,
} from "@/lib/actions/contacts";
import {
  createCompany,
  deleteCompany,
  getCompanyJobs,
  updateCompanyColor,
  updateCompanyDetails,
  type CompanyJob,
  type CrmCompany,
} from "@/lib/actions/companies";
import { ContactCard } from "@/components/crm/contact-card";
import { ContactFormDialog } from "@/components/crm/contact-form-dialog";
import { CONTACT_ROLES, contactRoleLabel } from "@/lib/types/contacts";
import { JOB_STATUS_LABELS, type JobStatus } from "@/lib/types/job";
import { getContactAvatarColorClass, getTagColorClass, cn } from "@/lib/utils";
import {
  Briefcase,
  Building2,
  ChevronDown,
  Globe,
  Link2,
  Mail,
  Pencil,
  Phone,
  Plus,
  Search,
  Tag,
  Trash2,
  UserRound,
  X,
} from "lucide-react";

interface CrmViewProps {
  companies: CrmCompany[];
  contacts: Contact[];
}

export function CrmView({ companies: initialCompanies, contacts: initialContacts }: CrmViewProps) {
  const [companies, setCompanies] = useState(initialCompanies);
  const [contacts, setContacts] = useState(initialContacts);
  const [view, setView] = useState<"contacts" | "companies">("contacts");
  const [addingCompany, setAddingCompany] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [pending, setPending] = useState(false);

  // Edit / Delete Company dialog state
  const [editingCompany, setEditingCompany] = useState<CrmCompany | null>(null);
  const [deletingCompanyObj, setDeletingCompanyObj] = useState<CrmCompany | null>(null);
  const [deletingCompanyPending, setDeletingCompanyPending] = useState(false);

  // Manage Tags dialog state
  const [manageTagsOpen, setManageTagsOpen] = useState(false);

  const handleCreateCompany = async () => {
    if (!companyName.trim()) return;
    setPending(true);
    try {
      const formData = new FormData();
      formData.append("name", companyName.trim());
      const { id } = await createCompany(formData);
      setCompanies((prev) =>
        prev.some((c) => c.id === id)
          ? prev
          : [...prev, { id, name: companyName.trim(), website: null, location: null, color: null, job_count: 0, contact_count: 0 }].sort((a, b) =>
              a.name.localeCompare(b.name)
            )
      );
      setCompanyName("");
      setAddingCompany(false);
      toast.success("Company created");
    } catch {
      toast.error("Couldn't create company");
    } finally {
      setPending(false);
    }
  };

  const handleCompanyCreated = (createdCompany: CrmCompany) => {
    setCompanies((prev) =>
      prev.some((c) => c.id === createdCompany.id)
        ? prev
        : [...prev, createdCompany].sort((a, b) => a.name.localeCompare(b.name))
    );
  };

  const handleCompanyUpdated = (updated: CrmCompany) => {
    setCompanies((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
  };

  const handleDeleteCompanyConfirm = async () => {
    if (!deletingCompanyObj) return;
    setDeletingCompanyPending(true);
    try {
      await deleteCompany(deletingCompanyObj.id);
      setCompanies((prev) => prev.filter((c) => c.id !== deletingCompanyObj.id));
      // Unlink company from contacts in state
      setContacts((prev) =>
        prev.map((c) => (c.company_id === deletingCompanyObj.id ? { ...c, company_id: null, company_name: null } : c))
      );
      toast.success(`Company "${deletingCompanyObj.name}" deleted`);
      setDeletingCompanyObj(null);
    } catch {
      toast.error("Couldn't delete company");
    } finally {
      setDeletingCompanyPending(false);
    }
  };

  const bumpContactCount = (companyId: string | null, delta: number) => {
    if (!companyId) return;
    setCompanies((prev) =>
      prev.map((c) => (c.id === companyId ? { ...c, contact_count: Math.max(0, c.contact_count + delta) } : c))
    );
  };

  // Tag management handlers
  const handleTagDeleted = (deletedTag: string) => {
    const lower = deletedTag.toLowerCase();
    setContacts((prev) =>
      prev.map((c) => {
        if (!c.role) return c;
        const remaining = c.role.split(",").map((t) => t.trim()).filter((t) => t && t.toLowerCase() !== lower);
        return { ...c, role: remaining.length > 0 ? remaining.join(", ") : null };
      })
    );
  };

  const handleTagRenamed = (oldTag: string, newTag: string) => {
    const oldLower = oldTag.toLowerCase();
    setContacts((prev) =>
      prev.map((c) => {
        if (!c.role) return c;
        const current = c.role.split(",").map((t) => t.trim()).filter(Boolean);
        if (current.some((t) => t.toLowerCase() === oldLower)) {
          const updated = current.map((t) => (t.toLowerCase() === oldLower ? newTag : t));
          const unique = Array.from(new Set(updated));
          return { ...c, role: unique.join(", ") };
        }
        return c;
      })
    );
  };

  return (
    <>
      <Tabs value={view} onValueChange={(v) => setView((v as "contacts" | "companies") ?? "contacts")}>
        <div className="flex items-center justify-between gap-2">
          <TabsList className="radio-inputs-header h-auto shrink-0 max-w-xs">
            <TabsTrigger value="contacts" className="radio-tab-trigger">
              <span>Contacts</span>
            </TabsTrigger>
            <TabsTrigger value="companies" className="radio-tab-trigger">
              <span>Companies</span>
            </TabsTrigger>
          </TabsList>

          {view === "companies" &&
            (addingCompany ? (
              <div className="flex items-center gap-2">
                <Input
                  autoFocus
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateCompany();
                    if (e.key === "Escape") {
                      setCompanyName("");
                      setAddingCompany(false);
                    }
                  }}
                  placeholder="Company name"
                  className="h-9 w-56"
                />
                <Button size="sm" onClick={handleCreateCompany} disabled={pending}>
                  {pending && <Spinner className="mr-1 size-4" />}
                  Add
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setCompanyName(""); setAddingCompany(false); }}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button size="sm" onClick={() => setAddingCompany(true)}>
                <Plus className="mr-1 size-4" />
                Add company
              </Button>
            ))}
        </div>

        <div className="radio-tabs-content-box mt-0">
          <div className="radio-tabs-content-inner">
            <TabsContent value="contacts" className="radio-tab-content-panel mt-0">
              <ContactsView
                contacts={contacts}
                setContacts={setContacts}
                companies={companies}
                onCompanyCountChange={bumpContactCount}
                onCompanyCreated={handleCompanyCreated}
                onOpenManageTags={() => setManageTagsOpen(true)}
                onTagDeleted={handleTagDeleted}
              />
            </TabsContent>

            <TabsContent value="companies" className="radio-tab-content-panel mt-0">
              {companies.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-12 text-center">
                  <p className="text-sm text-muted-foreground">No companies yet.</p>
                  <p className="mt-1 text-xs text-muted-foreground/70">
                    Companies appear automatically as you save jobs, or add one directly.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {companies.map((company) => (
                    <CompanyRow
                      key={company.id}
                      company={company}
                      onEdit={(c) => setEditingCompany(c)}
                      onDelete={(c) => setDeletingCompanyObj(c)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </div>
        </div>
      </Tabs>

      {/* Edit Company Dialog */}
      <CompanyEditDialog
        open={!!editingCompany}
        onOpenChange={(open) => !open && setEditingCompany(null)}
        company={editingCompany}
        onSaved={handleCompanyUpdated}
      />

      {/* Delete Company Confirmation Dialog */}
      <Dialog open={!!deletingCompanyObj} onOpenChange={(open) => !open && setDeletingCompanyObj(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Company</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <p className="text-sm text-foreground">
              Are you sure you want to delete <strong className="font-semibold">{deletingCompanyObj?.name}</strong>?
            </p>
            <p className="text-xs text-muted-foreground">
              Linked contacts and jobs will not be deleted, but will be unlinked from this company.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setDeletingCompanyObj(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteCompanyConfirm} disabled={deletingCompanyPending}>
              {deletingCompanyPending && <Spinner className="mr-1 size-4" />}
              Delete Company
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Tags Dialog */}
      <ManageTagsDialog
        open={manageTagsOpen}
        onOpenChange={setManageTagsOpen}
        contacts={contacts}
        onTagDeleted={handleTagDeleted}
        onTagRenamed={handleTagRenamed}
      />
    </>
  );
}

/** Person-first roster — every contact regardless of company, with company as a filterable/reassignable tag. */
function ContactsView({
  contacts,
  setContacts,
  companies,
  onCompanyCountChange,
  onCompanyCreated,
  onOpenManageTags,
  onTagDeleted,
}: {
  contacts: Contact[];
  setContacts: React.Dispatch<React.SetStateAction<Contact[]>>;
  companies: CrmCompany[];
  onCompanyCountChange: (companyId: string | null, delta: number) => void;
  onCompanyCreated?: (company: CrmCompany) => void;
  onOpenManageTags: () => void;
  onTagDeleted: (tag: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | undefined>(undefined);

  const companyName = (id: string | null) => companies.find((c) => c.id === id)?.name ?? null;

  // Gather all unique tag suggestions across contacts
  const tagSuggestions = useMemo(() => {
    const set = new Set<string>(PRESET_TAGS);
    contacts.forEach((c) => {
      if (c.role) {
        c.role.split(",").forEach((t) => {
          const trimmed = t.trim();
          if (trimmed) set.add(trimmed);
        });
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [contacts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts.filter((c) => {
      if (companyFilter === "unassigned" && c.company_id) return false;
      if (companyFilter !== "all" && companyFilter !== "unassigned" && c.company_id !== companyFilter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        (c.position ?? "").toLowerCase().includes(q) ||
        (c.role ?? "").toLowerCase().includes(q) ||
        (companyName(c.company_id) ?? "").toLowerCase().includes(q)
      );
    });
  }, [contacts, search, companyFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaved = (saved: Contact, createdCompany?: CrmCompany) => {
    if (createdCompany) {
      onCompanyCreated?.(createdCompany);
      onCompanyCountChange(createdCompany.id, 1);
    }
    setContacts((prev) => {
      const idx = prev.findIndex((c) => c.id === saved.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = saved;
        return copy;
      }
      return [...prev, saved].sort((a, b) => a.name.localeCompare(b.name));
    });
  };

  const handleDelete = async (contact: Contact) => {
    try {
      await deleteContact(contact.id);
      setContacts((prev) => prev.filter((c) => c.id !== contact.id));
      onCompanyCountChange(contact.company_id, -1);
    } catch {
      toast.error("Couldn't remove contact");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contacts, roles, position..."
            className="h-9 pl-8"
          />
        </div>
        <Select value={companyFilter} onValueChange={(v) => setCompanyFilter(v ?? "all")}>
          <SelectTrigger className="h-9 w-44">
            <SelectValue>
              {companyFilter === "all" ? "All companies" : companyFilter === "unassigned" ? "No company" : companyName(companyFilter)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All companies</SelectItem>
            <SelectItem value="unassigned">No company</SelectItem>
            {companies.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" onClick={onOpenManageTags}>
          <Tag className="mr-1 size-4 text-muted-foreground" />
          Manage Tags
        </Button>

        <Button
          size="sm"
          onClick={() => {
            setEditingContact(undefined);
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-1 size-4" />
          Add Contact
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-12 text-center">
          <p className="text-sm text-muted-foreground">
            {contacts.length === 0 ? "No contacts yet." : "No contacts match your search."}
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Add contacts with Notion-style tags, company associations, and social media links.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
          {filtered.map((contact, index) => (
            <ContactCard
              key={contact.id}
              contact={contact}
              index={index}
              onEdit={(c) => {
                setEditingContact(c);
                setDialogOpen(true);
              }}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <ContactFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        contact={editingContact}
        companies={companies}
        tagSuggestions={tagSuggestions}
        onSaved={handleSaved}
        onDeleted={(deletedId) => {
          const deletedContact = contacts.find((c) => c.id === deletedId);
          if (deletedContact) {
            setContacts((prev) => prev.filter((c) => c.id !== deletedId));
            onCompanyCountChange(deletedContact.company_id, -1);
          }
        }}
      />
    </div>
  );
}

const COMPANY_COLORS = [
  { value: "#10b981", label: "Emerald" },
  { value: "#6366f1", label: "Indigo" },
  { value: "#8b5cf6", label: "Violet" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#f43f5e", label: "Rose" },
  { value: "#06b6d4", label: "Cyan" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#64748b", label: "Slate" },
];

/** Company-grouped view — same roster, sorted under the company tag; a job list rides along for context. */
function CompanyRow({
  company,
  onEdit,
  onDelete,
}: {
  company: CrmCompany;
  onEdit?: (company: CrmCompany) => void;
  onDelete?: (company: CrmCompany) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [color, setColor] = useState<string | null>(company.color);
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [jobs, setJobs] = useState<CompanyJob[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [contactCount, setContactCount] = useState(company.contact_count);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  const load = async () => {
    if (contacts !== null) return;
    setLoading(true);
    const [c, j] = await Promise.all([getCompanyContacts(company.id), getCompanyJobs(company.id)]);
    setContacts(c);
    setJobs(j);
    setLoading(false);
  };

  const handleToggle = () => {
    setExpanded((v) => !v);
    if (!expanded) load();
  };

  const handleSetColor = async (newColor: string | null) => {
    setColor(newColor);
    setColorPickerOpen(false);
    try {
      await updateCompanyColor(company.id, newColor);
    } catch {
      toast.error("Couldn't update company color");
    }
  };

  return (
    <div
      className="rounded-2xl border border-border bg-card overflow-hidden transition-all"
      style={color ? { borderLeftColor: color, borderLeftWidth: "4px" } : undefined}
    >
      <div className="flex w-full items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={handleToggle}
          className="flex flex-1 items-center gap-3 text-left"
        >
          <div
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted"
            style={color ? { backgroundColor: `${color}20`, color } : undefined}
          >
            <Building2 className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{company.name}</p>
            {company.location && <p className="truncate text-xs text-muted-foreground">{company.location}</p>}
          </div>
        </button>

        <div className="flex items-center gap-2 shrink-0">
          {/* Color picker */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setColorPickerOpen((v) => !v)}
              className="flex size-5 items-center justify-center rounded-full border border-border/80 transition-transform hover:scale-110"
              style={{ backgroundColor: color ?? "transparent" }}
              title="Change column accent color"
            >
              {!color && <span className="size-2 rounded-full bg-muted-foreground/40" />}
            </button>

            {colorPickerOpen && (
              <div className="absolute right-0 top-full z-20 mt-1 flex items-center gap-1 rounded-xl border border-border bg-popover p-1.5 shadow-xs">
                {COMPANY_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => handleSetColor(c.value)}
                    className="size-5 rounded-full transition-transform hover:scale-110 focus:outline-none"
                    style={{ backgroundColor: c.value }}
                    title={c.label}
                  />
                ))}
                {color && (
                  <button
                    type="button"
                    onClick={() => handleSetColor(null)}
                    className="flex size-5 items-center justify-center rounded-full border border-border text-[10px] text-muted-foreground hover:bg-muted"
                    title="Clear color"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            )}
          </div>

          <span className="flex items-center gap-1 text-xs text-muted-foreground" title="Jobs">
            <Briefcase className="size-3.5" />
            {company.job_count}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground" title="Contacts">
            <UserRound className="size-3.5" />
            {contactCount}
          </span>

          {/* Edit Company */}
          <button
            type="button"
            onClick={() => onEdit?.(company)}
            className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Edit company details"
          >
            <Pencil className="size-3.5" />
          </button>

          {/* Delete Company */}
          <button
            type="button"
            onClick={() => onDelete?.(company)}
            className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            title="Delete company"
          >
            <Trash2 className="size-3.5" />
          </button>

          <button type="button" onClick={handleToggle} aria-label="Toggle section">
            <ChevronDown className={`size-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border px-4 py-3">
          {loading ? (
            <div className="flex justify-center py-4">
              <Spinner className="size-4" />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Jobs</h3>
                <div className="space-y-1">
                  {(jobs ?? []).map((job) => (
                    <Link
                      key={job.id}
                      href={`/jobs/${job.id}`}
                      className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-muted"
                    >
                      <span className="truncate">{job.title}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {JOB_STATUS_LABELS[job.status as JobStatus] ?? job.status}
                      </span>
                    </Link>
                  ))}
                  {(jobs ?? []).length === 0 && (
                    <p className="px-2 text-xs text-muted-foreground">No jobs saved at this company yet.</p>
                  )}
                </div>
              </div>

              <ContactsPanel
                companyId={company.id}
                contacts={contacts ?? []}
                onContactsChange={(next, delta) => {
                  setContacts(next);
                  setContactCount((n) => n + delta);
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ContactsPanel({
  companyId,
  contacts,
  onContactsChange,
}: {
  companyId: string;
  contacts: Contact[];
  onContactsChange: (next: Contact[], countDelta: number) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [newRole, setNewRole] = useState("other");
  const [linking, setLinking] = useState(false);
  const [orphans, setOrphans] = useState<Contact[] | null>(null);
  const [pending, setPending] = useState(false);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPending(true);
    try {
      const formData = new FormData(e.currentTarget);
      formData.append("role", newRole);
      const { id } = await createCompanyContact(companyId, formData);
      const newContact: Contact = {
        id,
        name: (formData.get("name") as string) || "",
        role: newRole,
        email: (formData.get("email") as string) || null,
        phone: (formData.get("phone") as string) || null,
        position: (formData.get("position") as string) || null,
        linkedin_url: (formData.get("linkedin_url") as string) || null,
        github_url: (formData.get("github_url") as string) || null,
        social_links: null,
        avatar_url: null,
        notes: null,
        company_id: companyId,
        company_name: null,
      };
      onContactsChange([...contacts, newContact], 1);
      setCreating(false);
      setNewRole("other");
    } catch {
      toast.error("Couldn't add contact");
    } finally {
      setPending(false);
    }
  };

  const openLinkPicker = async () => {
    setLinking(true);
    setOrphans(await getOrphanContacts());
  };

  const handleLink = async (contact: Contact) => {
    try {
      await setContactCompany(contact.id, companyId);
      onContactsChange([...contacts, { ...contact, company_id: companyId }], 1);
      setLinking(false);
    } catch {
      toast.error("Couldn't link contact");
    }
  };

  const handleRoleChange = async (contact: Contact, role: string) => {
    try {
      const formData = new FormData();
      formData.append("name", contact.name);
      formData.append("role", role);
      if (contact.email) formData.append("email", contact.email);
      if (contact.phone) formData.append("phone", contact.phone);
      if (contact.notes) formData.append("notes", contact.notes);
      await updateContact(contact.id, formData);
      onContactsChange(
        contacts.map((c) => (c.id === contact.id ? { ...c, role } : c)),
        0
      );
    } catch {
      toast.error("Couldn't update role");
    }
  };

  const handleDelete = async (contact: Contact) => {
    try {
      await deleteContact(contact.id);
      onContactsChange(
        contacts.filter((c) => c.id !== contact.id),
        -1
      );
    } catch {
      toast.error("Couldn't remove contact");
    }
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contacts</h3>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setCreating((v) => !v)}
            className="flex size-6 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Add contact"
          >
            <Plus className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={openLinkPicker}
            className="flex size-6 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Link existing contact"
          >
            <Link2 className="size-3.5" />
          </button>
        </div>
      </div>

      {creating && (
        <form onSubmit={handleCreate} className="mb-2 space-y-2 rounded-lg border border-border p-2">
          <Input name="name" required placeholder="Name *" className="h-8 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <Input name="email" type="email" placeholder="Email" className="h-8 text-sm" />
            <Input name="phone" placeholder="Phone" className="h-8 text-sm" />
          </div>
          <Select value={newRole} onValueChange={(v) => setNewRole(v ?? "other")}>
            <SelectTrigger className="h-8 w-full text-sm">
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
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              {pending && <Spinner className="mr-1" />}
              Add
            </Button>
          </div>
        </form>
      )}

      {linking && (
        <div className="mb-2 rounded-lg border border-border p-2">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Unassigned contacts</p>
            <button onClick={() => setLinking(false)} className="text-muted-foreground hover:text-foreground">
              <X className="size-3.5" />
            </button>
          </div>
          {orphans === null ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : orphans.length === 0 ? (
            <p className="text-xs text-muted-foreground">No unassigned contacts.</p>
          ) : (
            orphans
              .filter((o) => !contacts.some((c) => c.id === o.id))
              .map((o) => (
                <button
                  key={o.id}
                  onClick={() => handleLink(o)}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-left text-sm hover:bg-muted"
                >
                  {o.name}
                  <span className="text-xs text-muted-foreground">{contactRoleLabel(o.role)}</span>
                </button>
              ))
          )}
        </div>
      )}

      <div className="space-y-1.5">
        {contacts.map((contact) => (
          <div key={contact.id} className="rounded-lg border border-border p-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 min-w-0">
                {contact.avatar_url ? (
                  <img
                    src={contact.avatar_url}
                    alt={contact.name}
                    className="size-7 shrink-0 rounded-full object-cover shadow-xs border border-border mt-0.5"
                  />
                ) : (
                  <div
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold shadow-xs mt-0.5",
                      getContactAvatarColorClass(contact.role, contact.name)
                    )}
                  >
                    {(contact.name.trim()[0] || "C").toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{contact.name}</p>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    {contact.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="size-3" /> {contact.email}
                      </span>
                    )}
                    {contact.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="size-3" /> {contact.phone}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleDelete(contact)}
                className="flex size-6 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
            <Select value={contact.role ?? "other"} onValueChange={(v) => handleRoleChange(contact, v ?? "other")}>
              <SelectTrigger className="mt-1.5 h-7 w-fit text-xs" size="sm">
                <SelectValue>{contactRoleLabel(contact.role)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {CONTACT_ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
        {contacts.length === 0 && <p className="text-xs text-muted-foreground">No contacts at this company yet.</p>}
      </div>
    </div>
  );
}

const PRESET_TAGS = [
  "Alumni",
  "Recruiter",
  "Hiring Manager",
  "Employee",
  "Executive",
  "Referral",
  "Peer",
  "Primary Contact",
];

function CompanyEditDialog({
  company,
  open,
  onOpenChange,
  onSaved,
}: {
  company: CrmCompany | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (updated: CrmCompany) => void;
}) {
  const [name, setName] = useState(company?.name ?? "");
  const [website, setWebsite] = useState(company?.website ?? "");
  const [location, setLocation] = useState(company?.location ?? "");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (company) {
      setName(company.name ?? "");
      setWebsite(company.website ?? "");
      setLocation(company.location ?? "");
    }
  }, [company]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company || !name.trim()) return;
    setPending(true);
    try {
      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("website", website.trim());
      formData.append("location", location.trim());
      const updated = await updateCompanyDetails(company.id, formData);
      onSaved(updated);
      onOpenChange(false);
      toast.success("Company updated");
    } catch {
      toast.error("Couldn't update company");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Company</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="company-name">Company Name *</Label>
            <Input
              id="company-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Google"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="company-website">Website</Label>
            <Input
              id="company-website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://example.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="company-location">Location</Label>
            <Input
              id="company-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. San Francisco, CA"
            />
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner className="mr-1 size-4" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ManageTagsDialog({
  open,
  onOpenChange,
  contacts,
  onTagDeleted,
  onTagRenamed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: Contact[];
  onTagDeleted: (deletedTag: string) => void;
  onTagRenamed: (oldTag: string, newTag: string) => void;
}) {
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingTag, setDeletingTag] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Compute unique active tags across contacts + preset tags
  const allTags = useMemo(() => {
    const set = new Set<string>(PRESET_TAGS);
    contacts.forEach((c) => {
      if (c.role) {
        c.role.split(",").forEach((t) => {
          const trimmed = t.trim();
          if (trimmed) set.add(trimmed);
        });
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [contacts]);

  // Compute contact count per tag
  const tagCounts = useMemo(() => {
    const map = new Map<string, number>();
    contacts.forEach((c) => {
      if (c.role) {
        c.role.split(",").forEach((t) => {
          const trimmed = t.trim();
          if (trimmed) {
            map.set(trimmed, (map.get(trimmed) ?? 0) + 1);
          }
        });
      }
    });
    return map;
  }, [contacts]);

  const handleDeleteTag = async (tag: string) => {
    setPending(true);
    try {
      await deleteTag(tag);
      onTagDeleted(tag);
      toast.success(`Tag "${tag}" deleted`);
      setDeletingTag(null);
    } catch {
      toast.error(`Failed to delete tag "${tag}"`);
    } finally {
      setPending(false);
    }
  };

  const handleRenameTag = async (oldTag: string) => {
    const target = renameValue.trim();
    if (!target || target.toLowerCase() === oldTag.toLowerCase()) {
      setEditingTag(null);
      return;
    }
    setPending(true);
    try {
      await renameTag(oldTag, target);
      onTagRenamed(oldTag, target);
      toast.success(`Renamed tag to "${target}"`);
      setEditingTag(null);
    } catch {
      toast.error("Couldn't rename tag");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="size-5 text-primary" />
            Manage Tags
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <p className="text-xs text-muted-foreground">
            Manage your Notion-style tags. Deleting a tag will automatically remove it from all assigned contacts.
          </p>

          <div className="max-h-[350px] overflow-y-auto space-y-2 pr-1">
            {allTags.map((tag) => {
              const count = tagCounts.get(tag) ?? 0;
              const isEditing = editingTag === tag;
              const isConfirmingDelete = deletingTag === tag;

              return (
                <div
                  key={tag}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-2.5 transition-colors"
                >
                  {isEditing ? (
                    <div className="flex flex-1 items-center gap-2">
                      <Input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRenameTag(tag);
                          if (e.key === "Escape") setEditingTag(null);
                        }}
                        className="h-8 text-xs flex-1"
                      />
                      <Button size="sm" onClick={() => handleRenameTag(tag)} disabled={pending}>
                        Save
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setEditingTag(null)}>
                        Cancel
                      </Button>
                    </div>
                  ) : isConfirmingDelete ? (
                    <div className="flex flex-1 items-center justify-between text-xs">
                      <span className="font-medium text-destructive">
                        Delete &quot;{tag}&quot;? ({count} contact{count !== 1 ? "s" : ""})
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-7 text-xs px-2.5"
                          onClick={() => handleDeleteTag(tag)}
                          disabled={pending}
                        >
                          {pending && <Spinner className="mr-1 size-3" />}
                          Confirm
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => setDeletingTag(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge
                          className={cn(
                            "border font-medium text-xs px-2.5 py-1 rounded-md shrink-0",
                            getTagColorClass(tag)
                          )}
                        >
                          {tag}
                        </Badge>
                        <span className="text-xs text-muted-foreground truncate">
                          {count === 0 ? "Not assigned" : `${count} contact${count !== 1 ? "s" : ""}`}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTag(tag);
                            setRenameValue(tag);
                          }}
                          className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          title="Rename tag"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingTag(tag)}
                          className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                          title="Delete tag"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
