"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createCompanyContact,
  createPersonContact,
  deleteContact,
  getCompanyContacts,
  getOrphanContacts,
  setContactCompany,
  updateContact,
  type Contact,
} from "@/lib/actions/contacts";
import { createCompany, getCompanyJobs, type CompanyJob, type CrmCompany } from "@/lib/actions/companies";
import { CONTACT_ROLES, contactRoleLabel } from "@/lib/types/contacts";
import { JOB_STATUS_LABELS, type JobStatus } from "@/lib/types/job";
import {
  Briefcase,
  Building2,
  ChevronDown,
  Link2,
  Mail,
  Phone,
  Plus,
  Search,
  Trash2,
  UserRound,
  X,
} from "lucide-react";

interface CrmViewProps {
  companies: CrmCompany[];
  contacts: Contact[];
}

const NO_COMPANY = "__none__";

export function CrmView({ companies: initialCompanies, contacts: initialContacts }: CrmViewProps) {
  const [companies, setCompanies] = useState(initialCompanies);
  const [view, setView] = useState<"contacts" | "companies">("contacts");
  const [addingCompany, setAddingCompany] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [pending, setPending] = useState(false);

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
          : [...prev, { id, name: companyName.trim(), website: null, location: null, job_count: 0, contact_count: 0 }].sort((a, b) =>
              a.name.localeCompare(b.name)
            )
      );
      setCompanyName("");
      setAddingCompany(false);
    } catch {
      toast.error("Could not create company");
    } finally {
      setPending(false);
    }
  };

  const bumpContactCount = (companyId: string | null, delta: number) => {
    if (!companyId) return;
    setCompanies((prev) =>
      prev.map((c) => (c.id === companyId ? { ...c, contact_count: c.contact_count + delta } : c))
    );
  };

  return (
    <Tabs value={view} onValueChange={(v) => setView((v as "contacts" | "companies") ?? "contacts")}>
      <div className="flex items-center justify-between gap-2">
        <TabsList>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="companies">Companies</TabsTrigger>
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
                {pending && <Spinner className="mr-1" />}
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

      <TabsContent value="contacts" className="mt-4">
        <ContactsView
          initialContacts={initialContacts}
          companies={companies}
          onCompanyCountChange={bumpContactCount}
        />
      </TabsContent>

      <TabsContent value="companies" className="mt-4">
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
              <CompanyRow key={company.id} company={company} />
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}

/** Person-first roster — every contact regardless of company, with company as a filterable/reassignable tag. */
function ContactsView({
  initialContacts,
  companies,
  onCompanyCountChange,
}: {
  initialContacts: Contact[];
  companies: CrmCompany[];
  onCompanyCountChange: (companyId: string | null, delta: number) => void;
}) {
  const [contacts, setContacts] = useState(initialContacts);
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [creating, setCreating] = useState(false);
  const [newRole, setNewRole] = useState("other");
  const [newCompanyId, setNewCompanyId] = useState<string>(NO_COMPANY);
  const [pending, setPending] = useState(false);

  const companyName = (id: string | null) => companies.find((c) => c.id === id)?.name ?? null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts.filter((c) => {
      if (companyFilter === "unassigned" && c.company_id) return false;
      if (companyFilter !== "all" && companyFilter !== "unassigned" && c.company_id !== companyFilter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        (companyName(c.company_id) ?? "").toLowerCase().includes(q)
      );
    });
  }, [contacts, search, companyFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPending(true);
    try {
      const formData = new FormData(e.currentTarget);
      formData.append("role", newRole);
      const companyId = newCompanyId === NO_COMPANY ? null : newCompanyId;
      if (companyId) formData.append("company_id", companyId);
      const { id } = await createPersonContact(formData);
      const contact: Contact = {
        id,
        name: (formData.get("name") as string) || "",
        role: newRole,
        email: (formData.get("email") as string) || null,
        phone: (formData.get("phone") as string) || null,
        position: (formData.get("position") as string) || null,
        linkedin_url: (formData.get("linkedin_url") as string) || null,
        github_url: (formData.get("github_url") as string) || null,
        notes: null,
        company_id: companyId,
        company_name: companyName(companyId),
      };
      setContacts((prev) => [...prev, contact].sort((a, b) => a.name.localeCompare(b.name)));
      onCompanyCountChange(companyId, 1);
      setCreating(false);
      setNewRole("other");
      setNewCompanyId(NO_COMPANY);
    } catch {
      toast.error("Could not create contact");
    } finally {
      setPending(false);
    }
  };

  const handleTagChange = async (contact: Contact, companyId: string | null) => {
    try {
      await setContactCompany(contact.id, companyId);
      onCompanyCountChange(contact.company_id, -1);
      onCompanyCountChange(companyId, 1);
      setContacts((prev) =>
        prev.map((c) => (c.id === contact.id ? { ...c, company_id: companyId, company_name: companyName(companyId) } : c))
      );
    } catch {
      toast.error("Could not update company");
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
      setContacts((prev) => prev.map((c) => (c.id === contact.id ? { ...c, role } : c)));
    } catch {
      toast.error("Could not update role");
    }
  };

  const handleDelete = async (contact: Contact) => {
    try {
      await deleteContact(contact.id);
      setContacts((prev) => prev.filter((c) => c.id !== contact.id));
      onCompanyCountChange(contact.company_id, -1);
    } catch {
      toast.error("Could not remove contact");
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
            placeholder="Search contacts…"
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
        <Button size="sm" onClick={() => setCreating((v) => !v)}>
          <Plus className="mr-1 size-4" />
          Add contact
        </Button>
      </div>

      {creating && (
        <form onSubmit={handleCreate} className="space-y-3 rounded-2xl border border-border p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Input name="name" required placeholder="Name *" className="h-9" />
            <Input name="email" type="email" placeholder="Email" className="h-9" />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
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
            <Select value={newCompanyId} onValueChange={(v) => setNewCompanyId(v ?? NO_COMPANY)}>
              <SelectTrigger className="h-9 w-full">
                <SelectValue placeholder="Company (optional)">
                  {newCompanyId === NO_COMPANY ? "No company" : companyName(newCompanyId)}
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
          <Input name="phone" placeholder="Phone" className="h-9" />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              {pending && <Spinner className="mr-2" />}
              Add
            </Button>
          </div>
        </form>
      )}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-12 text-center">
          <p className="text-sm text-muted-foreground">
            {contacts.length === 0 ? "No contacts yet." : "No contacts match."}
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Add people directly, or they get pulled in automatically when AI spots a recruiter on a job posting.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="w-9" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell className="font-medium">{contact.name}</TableCell>
                  <TableCell>
                    <Select value={contact.role ?? "other"} onValueChange={(v) => handleRoleChange(contact, v ?? "other")}>
                      <SelectTrigger className="h-7 w-fit text-xs" size="sm">
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
                  </TableCell>
                  <TableCell>
                    <Select
                      value={contact.company_id ?? NO_COMPANY}
                      onValueChange={(v) => handleTagChange(contact, v === NO_COMPANY ? null : (v ?? null))}
                    >
                      <SelectTrigger className="h-7 w-fit max-w-40 text-xs" size="sm">
                        <Building2 className="mr-0.5 size-3 shrink-0 text-muted-foreground" />
                        <SelectValue placeholder="No company">
                          {contact.company_id ? companyName(contact.company_id) : "No company"}
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
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {contact.email ? (
                      <span className="flex items-center gap-1">
                        <Mail className="size-3" /> {contact.email}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {contact.phone ? (
                      <span className="flex items-center gap-1">
                        <Phone className="size-3" /> {contact.phone}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => handleDelete(contact)}
                      className="flex size-6 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Delete contact"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

/** Company-grouped view — same roster, sorted under the company tag; a job list rides along for context. */
function CompanyRow({ company }: { company: CrmCompany }) {
  const [expanded, setExpanded] = useState(false);
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [jobs, setJobs] = useState<CompanyJob[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [contactCount, setContactCount] = useState(company.contact_count);

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

  return (
    <div className="rounded-2xl border border-border bg-card">
      <button
        type="button"
        onClick={handleToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
          <Building2 className="size-4 text-muted-foreground/70" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{company.name}</p>
          {company.location && <p className="truncate text-xs text-muted-foreground">{company.location}</p>}
        </div>
        <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground" title="Jobs">
          <Briefcase className="size-3.5" />
          {company.job_count}
        </span>
        <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground" title="Contacts">
          <UserRound className="size-3.5" />
          {contactCount}
        </span>
        <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

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
        notes: null,
        company_id: companyId,
        company_name: null,
      };
      onContactsChange([...contacts, newContact], 1);
      setCreating(false);
      setNewRole("other");
    } catch {
      toast.error("Could not add contact");
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
      toast.error("Could not link contact");
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
      toast.error("Could not update role");
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
      toast.error("Could not remove contact");
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
