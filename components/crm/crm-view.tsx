"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  updateCompanyTier,
  updateCompanyDetails,
  backfillCompanyLogos,
  type CompanyJob,
  type CrmCompany,
} from "@/lib/actions/companies";
import { CompanyLogo } from "@/components/company-logo";
import { ContactCard } from "@/components/crm/contact-card";
import { ContactFormDialog } from "@/components/crm/contact-form-dialog";
import { CrmImportDialog } from "@/components/crm/crm-import-dialog";
import { useJsonSyncPreference } from "@/lib/hooks/use-json-sync-preference";
import { CONTACT_ROLES, contactRoleLabel } from "@/lib/types/contacts";
import { JOB_STATUS_LABELS, JOB_TIERS, type JobStatus, type JobTier } from "@/lib/types/job";
import { getContactAvatarColorClass, cn } from "@/lib/utils";
import {
  Briefcase,
  Building2,
  Mail,
  MoreHorizontal,
  Pencil,
  Tag,
  Trash2,
  UserRound,
  FileJson,
} from "lucide-react";
import { ChevronDownIcon } from "@/components/ui/chevron-down";
import { Link2Icon } from "@/components/ui/link-2";
import { PhoneIcon } from "@/components/ui/phone";
import { PlusIcon } from "@/components/ai-chatbot/plus-icon";
import { SearchIcon } from "@/components/ui/search";
import { XIcon } from "@/components/ui/x";

interface CrmViewProps {
  companies: CrmCompany[];
  contacts: Contact[];
}

export function CrmView({ companies: initialCompanies, contacts: initialContacts }: CrmViewProps) {
  const router = useRouter();
  const { enabled: jsonSyncEnabled } = useJsonSyncPreference();
  const [companies, setCompanies] = useState(initialCompanies);
  const [contacts, setContacts] = useState(initialContacts);
  const [view, setView] = useState<"contacts" | "companies">("contacts");
  const [addingCompany, setAddingCompany] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [companySearch, setCompanySearch] = useState("");
  const [companyTierFilter, setCompanyTierFilter] = useState<string>("all");
  const [pending, setPending] = useState(false);

  // Edit Company dialog state
  const [editingCompany, setEditingCompany] = useState<CrmCompany | null>(null);

  // Manage Tags dialog state
  const [manageTagsOpen, setManageTagsOpen] = useState(false);

  // CRM JSON Import dialog state
  const [crmImportOpen, setCrmImportOpen] = useState(false);

  const { confirm, dialog: confirmDialog } = useConfirm();

  // One-time automatic background company logo fetch & persistent SQLite storage
  useEffect(() => {
    const hasMissingLogos = initialCompanies.some((c) => c.logo_url === null && (c.website || c.name));
    if (hasMissingLogos) {
      backfillCompanyLogos()
        .then((res) => {
          if (res && res.updated > 0) {
            router.refresh();
          }
        })
        .catch(() => {});
    }
  }, [initialCompanies, router]);

  const filteredCompanies = useMemo(() => {
    const q = companySearch.trim().toLowerCase();
    return companies.filter((c) => {
      if (companyTierFilter !== "all") {
        if (companyTierFilter === "none" && c.tier) return false;
        if (companyTierFilter !== "none" && c.tier !== companyTierFilter) return false;
      }
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.location ?? "").toLowerCase().includes(q) ||
        (c.website ?? "").toLowerCase().includes(q)
      );
    });
  }, [companies, companySearch, companyTierFilter]);

  const handleCompanyTierChange = (companyId: string, tier: JobTier | null) => {
    setCompanies((prev) => prev.map((c) => (c.id === companyId ? { ...c, tier } : c)));
  };

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
          : [
              ...prev,
              {
                id,
                name: companyName.trim(),
                website: null,
                location: null,
                color: null,
                tier: null,
                job_count: 0,
                contact_count: 0,
              },
            ].sort((a, b) => a.name.localeCompare(b.name))
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

  const handleDeleteCompany = async (company: CrmCompany) => {
    const confirmed = await confirm({
      title: "Delete company?",
      description: `"${company.name}" will be permanently deleted. Linked contacts and jobs will not be deleted, but will be unlinked from this company. This can't be undone.`,
      confirmText: "Delete company",
      variant: "destructive",
    });
    if (!confirmed) return;

    try {
      await deleteCompany(company.id);
      setCompanies((prev) => prev.filter((c) => c.id !== company.id));
      // Unlink company from contacts in state
      setContacts((prev) =>
        prev.map((c) => (c.company_id === company.id ? { ...c, company_id: null, company_name: null } : c))
      );
      toast.success("Company deleted");
    } catch {
      toast.error("Couldn't delete company");
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
        <div className="flex items-center justify-between gap-2 border-b border-border pb-1">
          <TabsList variant="line" className="h-auto shrink-0 gap-1 p-0">
            <TabsTrigger
              value="contacts"
              className="px-3 py-2.5 text-sm font-semibold data-active:text-primary data-active:after:bg-primary"
            >
              Contacts
            </TabsTrigger>
            <TabsTrigger
              value="companies"
              className="px-3 py-2.5 text-sm font-semibold data-active:text-primary data-active:after:bg-primary"
            >
              Companies
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCompanyName("");
                    setAddingCompany(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {jsonSyncEnabled && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCrmImportOpen(true)}
                    className="gap-1.5 cursor-pointer"
                  >
                    <FileJson className="size-3.5 text-muted-foreground" />
                    Import JSON
                  </Button>
                )}
                <Button size="sm" onClick={() => setAddingCompany(true)} className="cursor-pointer">
                  <PlusIcon className="mr-1 size-4" />
                  Add company
                </Button>
              </div>
            ))}
        </div>

        <TabsContent value="contacts" className="mt-4">
          <ContactsView
            contacts={contacts}
            setContacts={setContacts}
            companies={companies}
            onCompanyCountChange={bumpContactCount}
            onCompanyCreated={handleCompanyCreated}
            onOpenManageTags={() => setManageTagsOpen(true)}
            onOpenImportJson={jsonSyncEnabled ? () => setCrmImportOpen(true) : undefined}
            onTagDeleted={handleTagDeleted}
          />
        </TabsContent>

        <TabsContent value="companies" className="mt-4 space-y-4">
          {companies.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 flex-1 min-w-48 max-w-lg">
                <div className="relative flex-1 min-w-44">
                  <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={companySearch}
                    onChange={(e) => setCompanySearch(e.target.value)}
                    placeholder="Search companies, locations..."
                    className="h-9 pl-8 text-xs"
                  />
                </div>
                <Select value={companyTierFilter} onValueChange={(v) => setCompanyTierFilter(v ?? "all")}>
                  <SelectTrigger className="h-9 w-32 text-xs">
                    <SelectValue placeholder="All tiers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tiers</SelectItem>
                    <SelectItem value="1">Tier 1 (Top)</SelectItem>
                    <SelectItem value="2">Tier 2 (Second)</SelectItem>
                    <SelectItem value="3">Tier 3 (Third)</SelectItem>
                    <SelectItem value="none">No tier</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <span className="text-xs font-medium text-muted-foreground">
                {filteredCompanies.length} {filteredCompanies.length === 1 ? "company" : "companies"}
              </span>
            </div>
          )}

          {companies.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-12 text-center">
              <p className="text-sm text-muted-foreground">No companies yet.</p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                Companies appear automatically as you save jobs, or add one directly.
              </p>
            </div>
          ) : filteredCompanies.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-12 text-center">
              <p className="text-sm text-muted-foreground">No companies match your search or tier filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 items-start">
              {filteredCompanies.map((company) => (
                <CompanyRow
                  key={company.id}
                  company={company}
                  onEdit={(c) => setEditingCompany(c)}
                  onDelete={handleDeleteCompany}
                  onTierChange={handleCompanyTierChange}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Company Dialog */}
      <CompanyEditDialog
        open={!!editingCompany}
        onOpenChange={(open) => !open && setEditingCompany(null)}
        company={editingCompany}
        onSaved={handleCompanyUpdated}
      />

      {confirmDialog}

      {/* Manage Tags Dialog */}
      <ManageTagsDialog
        open={manageTagsOpen}
        onOpenChange={setManageTagsOpen}
        contacts={contacts}
        onTagDeleted={handleTagDeleted}
        onTagRenamed={handleTagRenamed}
      />

      {/* CRM JSON Import Dialog */}
      <CrmImportDialog open={crmImportOpen} onOpenChange={setCrmImportOpen} />
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
  onOpenImportJson,
  onTagDeleted,
}: {
  contacts: Contact[];
  setContacts: React.Dispatch<React.SetStateAction<Contact[]>>;
  companies: CrmCompany[];
  onCompanyCountChange: (companyId: string | null, delta: number) => void;
  onCompanyCreated?: (company: CrmCompany) => void;
  onOpenManageTags: () => void;
  onOpenImportJson?: () => void;
  onTagDeleted: (tag: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | undefined>(undefined);

  // O(K) pre-indexing for O(1) constant-time company name lookup
  const companyMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of companies) {
      map.set(c.id, c.name);
    }
    return map;
  }, [companies]);

  const companyName = (id: string | null) => (id ? companyMap.get(id) ?? null : null);

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
      const compName = c.company_id ? companyMap.get(c.company_id) ?? "" : "";
      return (
        c.name.toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        (c.position ?? "").toLowerCase().includes(q) ||
        (c.role ?? "").toLowerCase().includes(q) ||
        compName.toLowerCase().includes(q)
      );
    });
  }, [contacts, search, companyFilter, companyMap]);

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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
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
              {companyFilter === "all"
                ? "All companies"
                : companyFilter === "unassigned"
                ? "No company"
                : companyName(companyFilter)}
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
          Manage tags
        </Button>

        {onOpenImportJson && (
          <Button variant="outline" size="sm" onClick={onOpenImportJson} className="gap-1.5 cursor-pointer">
            <FileJson className="size-3.5 text-muted-foreground" />
            Import JSON
          </Button>
        )}

        <Button
          size="sm"
          onClick={() => {
            setEditingContact(undefined);
            setDialogOpen(true);
          }}
        >
          <PlusIcon className="mr-1 size-4" />
          Add contact
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

/** Company-grouped view — same roster, sorted under the company tag; a job list rides along for context. */
function CompanyRow({
  company,
  onEdit,
  onDelete,
  onTierChange,
}: {
  company: CrmCompany;
  onEdit?: (company: CrmCompany) => void;
  onDelete?: (company: CrmCompany) => void;
  onTierChange?: (companyId: string, tier: JobTier | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [tier, setTier] = useState<JobTier | null>(company.tier ?? null);
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

  const handleSetTier = async (newTier: JobTier | null) => {
    if (tier === newTier) return;
    setTier(newTier);
    onTierChange?.(company.id, newTier);
    try {
      await updateCompanyTier(company.id, newTier);
      toast.success(newTier ? `${company.name} set to ${JOB_TIERS[newTier].label}` : "Company tier cleared");
    } catch {
      toast.error("Couldn't update company tier");
    }
  };

  const tierConfig = tier && JOB_TIERS[tier] ? JOB_TIERS[tier] : null;

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card overflow-hidden transition-all duration-150 shadow-2xs",
        tier === "1" && "border-amber-500/40 bg-gradient-to-r from-amber-500/[0.05] via-transparent to-transparent dark:border-amber-500/30",
        tier === "2" && "border-blue-500/40 bg-gradient-to-r from-blue-500/[0.05] via-transparent to-transparent dark:border-blue-500/30",
        tier === "3" && "border-purple-500/40 bg-gradient-to-r from-purple-500/[0.05] via-transparent to-transparent dark:border-purple-500/30",
        !tier && "border-border hover:border-border/80 hover:bg-card/90"
      )}
    >
      <div className="flex w-full items-center justify-between px-3.5 py-2.5 gap-2.5">
        <button
          type="button"
          onClick={handleToggle}
          aria-expanded={expanded}
          className="group flex flex-1 items-center gap-2.5 text-left rounded-lg min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <CompanyLogo
            name={company.name}
            website={company.website}
            logoUrl={company.logo_url}
            companyId={company.id}
            color={company.color ?? (tierConfig ? tierConfig.dotColor : undefined)}
            className="size-8"
            fallback="initial"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                {company.name}
              </p>
              {tierConfig && (
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.2 text-[10px] font-semibold tracking-tight shadow-2xs",
                    tierConfig.badgeClass
                  )}
                  title={`${tierConfig.label} · ${tierConfig.description}`}
                >
                  <span
                    className="size-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: tierConfig.dotColor }}
                  />
                  {tierConfig.label}
                </span>
              )}
            </div>
            {(company.location || company.website) && (
              <p className="truncate text-[11px] text-muted-foreground">
                {[company.location, company.website?.replace(/^https?:\/\//, "")].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        </button>

        <div className="flex items-center gap-1 shrink-0">
          {/* Metadata badges */}
          <span
            className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground"
            title={`${company.job_count} linked jobs`}
          >
            <Briefcase className="size-3" />
            {company.job_count}
          </span>
          <span
            className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground"
            title={`${contactCount} linked contacts`}
          >
            <UserRound className="size-3" />
            {contactCount}
          </span>

          {/* Context Menu (Priority Tier, Edit, Delete) */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  aria-label="Company options"
                  className="flex size-6.5 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <MoreHorizontal className="size-3.5" />
                </button>
              }
            />
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="px-2 py-1 text-xs font-medium text-muted-foreground">
                Priority Tier
              </DropdownMenuLabel>
              {(["1", "2", "3"] as JobTier[]).map((t) => {
                const cfg = JOB_TIERS[t];
                const isSelected = tier === t;
                return (
                  <DropdownMenuItem
                    key={t}
                    onClick={() => handleSetTier(isSelected ? null : t)}
                    className={cn(
                      "flex items-center justify-between cursor-pointer",
                      isSelected && "font-semibold bg-accent"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="size-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: cfg.dotColor }}
                      />
                      <span>{cfg.label}</span>
                    </div>
                    <span className="text-[11px] text-muted-foreground">{cfg.description}</span>
                  </DropdownMenuItem>
                );
              })}
              {tier && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleSetTier(null)}
                    className="text-xs text-muted-foreground cursor-pointer"
                  >
                    <XIcon className="mr-2 size-3" />
                    Clear tier
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onEdit?.(company)}>
                <Pencil className="mr-2 size-3 text-muted-foreground" />
                Edit details
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => onDelete?.(company)}
              >
                <Trash2 className="mr-2 size-3" />
                Delete company
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Expand toggle */}
          <button
            type="button"
            onClick={handleToggle}
            aria-label={expanded ? "Collapse section" : "Expand section"}
            aria-expanded={expanded}
            className="flex size-6.5 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <ChevronDownIcon
              className={cn("size-3.5 transition-transform duration-200", expanded && "rotate-180")}
            />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border bg-muted/15 px-3.5 py-3 space-y-3.5">
          {loading ? (
            <div className="flex justify-center py-4">
              <Spinner className="size-4" />
            </div>
          ) : (
            <>
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Jobs ({(jobs ?? []).length})
                  </h3>
                </div>
                <div className="space-y-1">
                  {(jobs ?? []).map((job) => (
                    <Link
                      key={job.id}
                      href={`/jobs/${job.id}`}
                      className="group flex items-center justify-between rounded-lg border border-border/60 bg-card px-2.5 py-1.5 text-xs transition-colors hover:border-primary/40 hover:bg-muted/50"
                    >
                      <span className="truncate font-medium text-foreground group-hover:text-primary transition-colors">
                        {job.title}
                      </span>
                      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                        {JOB_STATUS_LABELS[job.status as JobStatus] ?? job.status}
                      </span>
                    </Link>
                  ))}
                  {(jobs ?? []).length === 0 && (
                    <div className="rounded-lg border border-dashed border-border py-2.5 text-center">
                      <p className="text-[11px] text-muted-foreground">No jobs saved at this company.</p>
                    </div>
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
            </>
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
  const { confirm, dialog: confirmDialog } = useConfirm();

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
    const confirmed = await confirm({
      title: "Remove this contact?",
      description: `"${contact.name}" will be permanently deleted. This can't be undone.`,
      confirmText: "Remove contact",
      variant: "destructive",
    });
    if (!confirmed) return;

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
      <div className="mb-2.5 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Contacts ({contacts.length})
        </h3>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => setCreating((v) => !v)}
            className="h-7 text-xs"
          >
            <PlusIcon className="mr-1 size-3" />
            Add
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={openLinkPicker}
            className="h-7 text-xs"
          >
            <Link2Icon className="mr-1 size-3" />
            Link
          </Button>
        </div>
      </div>

      {creating && (
        <form onSubmit={handleCreate} className="mb-3 space-y-2 rounded-xl border border-border bg-card p-3 shadow-2xs">
          <Input name="name" required placeholder="Name *" className="h-8 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <Input name="email" type="email" placeholder="Email" className="h-8 text-sm" />
            <Input name="phone" placeholder="Phone" className="h-8 text-sm" />
          </div>
          <Select value={newRole} onValueChange={(v) => setNewRole(v ?? "other")}>
            <SelectTrigger className="h-8 w-full text-xs">
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
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" size="xs" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button type="submit" size="xs" disabled={pending}>
              {pending && <Spinner className="mr-1 size-3" />}
              Save contact
            </Button>
          </div>
        </form>
      )}

      {linking && (
        <div className="mb-3 rounded-xl border border-border bg-card p-3 shadow-2xs">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Link unassigned contact</p>
            <button
              type="button"
              onClick={() => setLinking(false)}
              aria-label="Close"
              className="rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <XIcon className="size-3.5" />
            </button>
          </div>
          {orphans === null ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : orphans.length === 0 ? (
            <p className="text-xs text-muted-foreground">No unassigned contacts.</p>
          ) : (
            <div className="space-y-1">
              {orphans
                .filter((o) => !contacts.some((c) => c.id === o.id))
                .map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => handleLink(o)}
                    className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <span className="font-medium text-foreground">{o.name}</span>
                    <span className="text-xs text-muted-foreground">{contactRoleLabel(o.role)}</span>
                  </button>
                ))}
            </div>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        {contacts.map((contact) => (
          <div key={contact.id} className="rounded-xl border border-border/60 bg-card p-2.5 transition-colors hover:border-border">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2.5 min-w-0">
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
                  <p className="truncate text-sm font-medium text-foreground">{contact.name}</p>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    {contact.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="size-3" /> {contact.email}
                      </span>
                    )}
                    {contact.phone && (
                      <span className="flex items-center gap-1">
                        <PhoneIcon className="size-3" /> {contact.phone}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(contact)}
                aria-label={`Remove ${contact.name}`}
                className="flex size-6 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
            <Select value={contact.role ?? "other"} onValueChange={(v) => handleRoleChange(contact, v ?? "other")}>
              <SelectTrigger className="mt-2 h-7 w-fit text-xs" size="sm">
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
        {contacts.length === 0 && (
          <div className="rounded-xl border border-dashed border-border py-4 text-center">
            <p className="text-xs text-muted-foreground">No contacts at this company yet.</p>
          </div>
        )}
      </div>
      {confirmDialog}
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
  const [tier, setTier] = useState<string>(company?.tier ?? "none");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (company) {
      setName(company.name ?? "");
      setWebsite(company.website ?? "");
      setLocation(company.location ?? "");
      setTier(company.tier ?? "none");
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
      formData.append("tier", tier === "none" ? "" : tier);
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
          <div className="flex items-center gap-3">
            <CompanyLogo
              name={name || company?.name}
              website={website || company?.website}
              logoUrl={company?.logo_url}
              companyId={company?.id}
              color={company?.color}
              className="size-10 rounded-xl"
              fallback="initial"
            />
            <div>
              <DialogTitle>Edit company</DialogTitle>
              <p className="text-xs text-muted-foreground">Update details and logo for {name || company?.name}</p>
            </div>
          </div>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="company-name">Company name *</Label>
            <Input
              id="company-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Google"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Priority Tier</Label>
            <Select value={tier} onValueChange={(v) => setTier(v ?? "none")}>
              <SelectTrigger className="h-9 w-full text-xs">
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
              Save changes
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
      toast.error(`Couldn't delete tag "${tag}"`);
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
            <Tag className="size-5 text-foreground" />
            Manage tags
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
                  className="flex items-center justify-between rounded-xl border border-border bg-card p-2.5 transition-colors hover:border-primary/30"
                >
                  {isEditing ? (
                    <div className="flex flex-1 items-center gap-2 mr-2">
                      <Input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRenameTag(tag);
                          if (e.key === "Escape") setEditingTag(null);
                        }}
                        className="h-8 text-sm"
                      />
                      <Button
                        size="xs"
                        onClick={() => handleRenameTag(tag)}
                        disabled={pending}
                      >
                        Save
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => setEditingTag(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : isConfirmingDelete ? (
                    <div className="flex flex-1 items-center justify-between mr-2 text-xs">
                      <span className="text-destructive font-medium">Delete tag from {count} contacts?</span>
                      <div className="flex gap-1.5">
                        <Button
                          variant="destructive"
                          size="xs"
                          onClick={() => handleDeleteTag(tag)}
                          disabled={pending}
                        >
                          Confirm
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setDeletingTag(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-md border border-border/80 bg-muted/60 px-2 py-0.5 text-xs font-medium text-foreground">
                        {tag}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {count} {count === 1 ? "contact" : "contacts"}
                      </span>
                    </div>
                  )}

                  {!isEditing && !isConfirmingDelete && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingTag(tag);
                          setRenameValue(tag);
                        }}
                        aria-label={`Rename ${tag}`}
                        className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                        title="Rename tag"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingTag(tag)}
                        aria-label={`Delete ${tag}`}
                        className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                        title="Delete tag"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
