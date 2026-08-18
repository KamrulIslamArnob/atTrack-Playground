"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { getLinksAndCategories, createCategory, createLink, createQuickShortcut } from "@/lib/actions/links";
import { importJobsFromJson, type JsonImportResult } from "@/lib/actions/job-imports";
import type { BoardList, JobDeadline, ListKind } from "@/lib/types/board";
import type { JobDetailData } from "@/lib/types/job-detail";
import type { JobDocument } from "@/lib/actions/documents";
import type { LinkCategory, SocialLink, QuickShortcut } from "@/lib/types/links";

// Re-export job import function for convenience
export { importJobsFromJson, type JsonImportResult };

// ============================================================================
// 1. JOBS DATA EXPORT
// ============================================================================

export interface JobsBackupPayload {
  version: 1;
  type: "jobs_backup";
  exported_at: string;
  count: number;
  jobs: JobDetailData[];
  boardLists: BoardList[];
}

export async function exportAllJobsData(): Promise<JobsBackupPayload> {
  const { supabase, userId } = await getUser();
  if (!userId) throw new Error("Unauthorized");

  // Fetch all jobs, lists, companies, applications, interviews, deadlines, contacts, and documents in parallel
  const [
    { data: rawJobs },
    { data: rawBoardLists },
    { data: rawCompanies },
    { data: rawApplications },
    { data: rawInterviews },
    { data: rawDeadlines },
    { data: rawContacts },
    { data: rawDocuments },
    { data: profile },
  ] = await Promise.all([
    supabase.from("jobs").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("board_lists").select("*").eq("user_id", userId).order("sort_order", { ascending: true }),
    supabase.from("companies").select("*").eq("user_id", userId),
    supabase.from("applications").select("*").eq("user_id", userId),
    supabase.from("interviews").select("*").eq("user_id", userId),
    supabase.from("job_deadlines").select("*").eq("user_id", userId),
    supabase.from("contacts").select("*").eq("user_id", userId),
    supabase.from("documents").select("id, user_id, job_id, name, type, file_path, generated_kind, content, created_at").eq("user_id", userId),
    supabase.from("profiles").select("full_name, headline").eq("id", userId).maybeSingle(),
  ]);

  const jobsList = (rawJobs ?? []) as Array<Record<string, unknown>>;
  const boardLists = (rawBoardLists ?? []) as BoardList[];
  const companies = (rawCompanies ?? []) as Array<Record<string, unknown>>;
  const applications = (rawApplications ?? []) as Array<Record<string, unknown>>;
  const interviews = (rawInterviews ?? []) as Array<Record<string, unknown>>;
  const deadlines = (rawDeadlines ?? []) as Array<Record<string, unknown>>;
  const contacts = (rawContacts ?? []) as Array<Record<string, unknown>>;
  const documents = (rawDocuments ?? []) as Array<Record<string, unknown>>;

  const formattedJobs: JobDetailData[] = jobsList.map((j) => {
    const jobId = j.id as string;
    const companyId = j.company_id as string;
    const comp = companies.find((c) => c.id === companyId);

    const jobApplications = applications
      .filter((a) => a.job_id === jobId)
      .map((a) => ({
        id: a.id as string,
        status: (a.status as string) || "applied",
        applied_at: (a.applied_at as string) || null,
        created_at: (a.created_at as string) || new Date().toISOString(),
        resume_name: (a.resume_name as string) || null,
      }));

    const jobInterviews = interviews
      .filter((iv) => iv.job_id === jobId)
      .map((iv) => ({
        id: iv.id as string,
        scheduled_at: (iv.scheduled_at as string) || null,
        type: (iv.type as string) || null,
        location: (iv.location as string) || null,
        meeting_url: (iv.meeting_url as string) || null,
        interviewer_name: (iv.interviewer_name as string) || null,
        interviewer_email: (iv.interviewer_email as string) || null,
        notes: (iv.notes as string) || null,
        status: (iv.status as string) || "scheduled",
      }));

    const jobContacts = contacts
      .filter((ct) => ct.job_id === jobId || ct.company_id === companyId)
      .map((ct) => ({
        id: ct.id as string,
        name: ct.name as string,
        role: (ct.role as string) || (ct.title as string) || null,
        email: (ct.email as string) || null,
        phone: (ct.phone as string) || null,
        position: (ct.position as string) || null,
        linkedin_url: (ct.linkedin_url as string) || null,
        github_url: (ct.github_url as string) || null,
        social_links: (ct.social_links as string) || null,
        avatar_url: (ct.avatar_url as string) || null,
        notes: (ct.notes as string) || null,
        company_id: (ct.company_id as string) || null,
        company_name: comp ? (comp.name as string) : null,
      }));

    const jobDocuments: JobDocument[] = documents
      .filter((d) => d.job_id === jobId)
      .map((d) => ({
        id: d.id as string,
        name: d.name as string,
        type: (d.type as string) || "other",
        generated_kind: (d.generated_kind as string) || null,
        file_path: (d.file_path as string) || "",
        created_at: (d.created_at as string) || new Date().toISOString(),
      }));

    const jobDeadlines: JobDeadline[] = deadlines
      .filter((dl) => dl.job_id === jobId)
      .map((dl) => ({
        id: dl.id as string,
        job_id: jobId,
        title: dl.title as string,
        type: ((dl.type as string) || "deadline") as "deadline" | "milestone",
        stage_kind: ((dl.stage_kind as string) || "custom") as ListKind | "custom" | null,
        due_date: (dl.due_date as string) || "",
        is_pinned: Boolean(dl.is_pinned),
        is_completed: Boolean(dl.is_completed),
        notes: (dl.notes as string) || null,
        created_at: (dl.created_at as string) || new Date().toISOString(),
      }));

    return {
      job: {
        id: jobId,
        title: (j.title as string) || "Untitled Position",
        state: ((j.state as string) || "active") as import("@/lib/types/job").JobState,
        description: (j.description as string) || null,
        application_url: (j.application_url as string) || null,
        application_email: (j.application_email as string) || null,
        application_process: (j.application_process as string) || null,
        location: (j.location as string) || null,
        salary_range: (j.salary_range as string) || null,
        salary_min: typeof j.salary_min === "number" ? j.salary_min : null,
        salary_max: typeof j.salary_max === "number" ? j.salary_max : null,
        salary_currency: (j.salary_currency as string) || null,
        salary_period: (j.salary_period as string) || null,
        is_unpaid: Boolean(j.is_unpaid),
        employment_type: (j.employment_type as string) || null,
        work_location: (j.work_location as string) || null,
        deadline: (j.deadline as string) || null,
        section_deadline: (j.section_deadline as string) || null,
        section_deadline_list_id: (j.section_deadline_list_id as string) || null,
        source: (j.source as string) || null,
        status: (j.status as string) || "saved",
        notes: Array.isArray(j.notes) ? (j.notes as Array<{ title: string; bullets: string[] }>) : null,
        skills: Array.isArray(j.skills) ? (j.skills as string[]) : null,
        educational_requirements: (j.educational_requirements as string) || null,
        benefits: Array.isArray(j.benefits) ? (j.benefits as string[]) : null,
        work_schedule: (j.work_schedule as string) || null,
        holiday_policy: (j.holiday_policy as string) || null,
        map_url: (j.map_url as string) || null,
        match_score: typeof j.match_score === "number" ? j.match_score : null,
        match_reasoning: (j.match_reasoning as string) || null,
        resume_id: (j.resume_id as string) || null,
        resume_name: null,
        project_links: Array.isArray(j.project_links) ? (j.project_links as import("@/lib/types/board").ProjectLink[]) : null,
        color: (j.color as string) || null,
        tier: ((j.tier as string) || null) as import("@/lib/types/job").JobTier | null,
        position_id: (j.position_id as string) || null,
        position_name: null,
        list_id: (j.list_id as string) || null,
        created_at: (j.created_at as string) || new Date().toISOString(),
      },
      company: comp
        ? {
            id: comp.id as string,
            name: comp.name as string,
            website: (comp.website as string) || null,
            location: (comp.location as string) || null,
            founded_year: typeof comp.founded_year === "number" ? comp.founded_year : null,
            company_type: (comp.company_type as string) || null,
            country: (comp.country as string) || null,
          }
        : null,
      applications: jobApplications,
      interviews: jobInterviews,
      contacts: jobContacts,
      documents: jobDocuments,
      resumeOptions: [],
      boardLists,
      deadlines: jobDeadlines,
      smtpReady: false,
      applicantName: profile?.full_name ?? "",
      applicantHeadline: profile?.headline ?? null,
      resumeContent: null,
    };
  });

  return {
    version: 1,
    type: "jobs_backup",
    exported_at: new Date().toISOString(),
    count: formattedJobs.length,
    jobs: formattedJobs,
    boardLists,
  };
}

// ============================================================================
// 2. CRM DATA EXPORT & IMPORT
// ============================================================================

export interface CrmBackupPayload {
  version: 1;
  type: "crm_backup";
  exported_at: string;
  companiesCount: number;
  contactsCount: number;
  companies: Array<Record<string, unknown>>;
  contacts: Array<Record<string, unknown>>;
}

export interface CrmImportResult {
  success: boolean;
  companiesCreated: number;
  companiesUpdated: number;
  contactsCreated: number;
  contactsUpdated: number;
  errors: string[];
}

export async function exportCrmData(): Promise<CrmBackupPayload> {
  const { supabase, userId } = await getUser();
  if (!userId) throw new Error("Unauthorized");

  const [{ data: rawCompanies }, { data: rawContacts }] = await Promise.all([
    supabase.from("companies").select("*").eq("user_id", userId).order("name", { ascending: true }),
    supabase.from("contacts").select("*").eq("user_id", userId).order("name", { ascending: true }),
  ]);

  const companies = (rawCompanies ?? []) as Array<Record<string, unknown>>;
  const contacts = (rawContacts ?? []) as Array<Record<string, unknown>>;

  return {
    version: 1,
    type: "crm_backup",
    exported_at: new Date().toISOString(),
    companiesCount: companies.length,
    contactsCount: contacts.length,
    companies,
    contacts,
  };
}

export async function importCrmFromJson(rawJson: string): Promise<CrmImportResult> {
  const { supabase, userId } = await getUser();
  if (!userId) throw new Error("Unauthorized");

  if (!rawJson || !rawJson.trim()) {
    throw new Error("No JSON content provided.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson.trim());
  } catch {
    throw new Error("Invalid JSON syntax.");
  }

  let rawCompanies: Array<Record<string, unknown>> = [];
  let rawContacts: Array<Record<string, unknown>> = [];

  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.companies)) {
      rawCompanies = obj.companies as Array<Record<string, unknown>>;
    }
    if (Array.isArray(obj.contacts)) {
      rawContacts = obj.contacts as Array<Record<string, unknown>>;
    }
    if (Array.isArray(parsed)) {
      // Direct array: detect items
      for (const item of parsed as Array<Record<string, unknown>>) {
        if (item && typeof item === "object") {
          if (item.email || item.phone || item.role || item.position) {
            rawContacts.push(item);
          } else if (item.name) {
            rawCompanies.push(item);
          }
        }
      }
    }
  }

  if (rawCompanies.length === 0 && rawContacts.length === 0) {
    throw new Error("No company or contact records found in JSON.");
  }

  let companiesCreated = 0;
  let companiesUpdated = 0;
  let contactsCreated = 0;
  let contactsUpdated = 0;
  const errors: string[] = [];

  // Map old company IDs from source payload to local company IDs
  const companyIdMap = new Map<string, string>();

  // 1. Process Companies
  for (const comp of rawCompanies) {
    try {
      const name = (comp.name as string)?.trim();
      if (!name) continue;

      const oldId = comp.id as string | undefined;
      const website = (comp.website as string) || null;
      const location = (comp.location as string) || null;
      const foundedYear = typeof comp.founded_year === "number" ? comp.founded_year : null;
      const companyType = (comp.company_type as string) || null;
      const country = (comp.country as string) || null;
      const color = (comp.color as string) || null;
      const tier = (comp.tier as string) || null;

      // Check existing
      let localCompanyId: string;
      const { data: existing } = await supabase
        .from("companies")
        .select("id")
        .eq("user_id", userId)
        .ilike("name", name)
        .maybeSingle();

      if (existing) {
        localCompanyId = (existing as unknown as { id: string }).id;
        await supabase
          .from("companies")
          .update({
            website,
            location,
            founded_year: foundedYear,
            company_type: companyType,
            country,
            color,
            tier,
          })
          .eq("id", localCompanyId)
          .eq("user_id", userId);
        companiesUpdated++;
      } else {
        const { data: newComp, error: insErr } = await supabase
          .from("companies")
          .insert({
            user_id: userId,
            name,
            website,
            location,
            founded_year: foundedYear,
            company_type: companyType,
            country,
            color,
            tier,
          })
          .select("id")
          .single();

        if (insErr || !newComp) throw new Error(insErr?.message || "Failed to create company");
        localCompanyId = (newComp as unknown as { id: string }).id;
        companiesCreated++;
      }

      if (oldId) {
        companyIdMap.set(oldId, localCompanyId);
      }
      companyIdMap.set(name.toLowerCase(), localCompanyId);
    } catch (err: unknown) {
      errors.push(`Company "${comp.name || "unknown"}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 2. Process Contacts
  for (const ct of rawContacts) {
    try {
      const name = (ct.name as string)?.trim();
      if (!name) continue;

      const email = (ct.email as string)?.trim() || null;
      const phone = (ct.phone as string)?.trim() || null;
      const role = (ct.role as string)?.trim() || (ct.position as string)?.trim() || null;
      const position = (ct.position as string)?.trim() || null;
      const linkedinUrl = (ct.linkedin_url as string)?.trim() || null;
      const githubUrl = (ct.github_url as string)?.trim() || null;
      const socialLinks = (ct.social_links as string) || null;
      const avatarUrl = (ct.avatar_url as string) || null;
      const notes = (ct.notes as string) || null;

      // Resolve Company ID
      let resolvedCompanyId: string | null = null;
      if (ct.company_id && companyIdMap.has(ct.company_id as string)) {
        resolvedCompanyId = companyIdMap.get(ct.company_id as string)!;
      } else if (ct.company_name && companyIdMap.has((ct.company_name as string).toLowerCase())) {
        resolvedCompanyId = companyIdMap.get((ct.company_name as string).toLowerCase())!;
      }

      // Check existing contact by email or (company_id + name)
      let existingContact: { id: string } | null = null;
      if (email) {
        const { data: byEmail } = await supabase
          .from("contacts")
          .select("id")
          .eq("user_id", userId)
          .eq("email", email)
          .maybeSingle();
        if (byEmail) existingContact = byEmail as unknown as { id: string };
      }

      if (!existingContact && resolvedCompanyId) {
        const { data: byNameAndComp } = await supabase
          .from("contacts")
          .select("id")
          .eq("user_id", userId)
          .eq("company_id", resolvedCompanyId)
          .ilike("name", name)
          .maybeSingle();
        if (byNameAndComp) existingContact = byNameAndComp as unknown as { id: string };
      }

      if (existingContact) {
        await supabase
          .from("contacts")
          .update({
            name,
            role,
            email,
            phone,
            position,
            linkedin_url: linkedinUrl,
            github_url: githubUrl,
            social_links: socialLinks,
            avatar_url: avatarUrl,
            notes,
            company_id: resolvedCompanyId,
          })
          .eq("id", existingContact.id)
          .eq("user_id", userId);
        contactsUpdated++;
      } else {
        await supabase.from("contacts").insert({
          user_id: userId,
          name,
          role,
          email,
          phone,
          position,
          linkedin_url: linkedinUrl,
          github_url: githubUrl,
          social_links: socialLinks,
          avatar_url: avatarUrl,
          notes,
          company_id: resolvedCompanyId,
        });
        contactsCreated++;
      }
    } catch (err: unknown) {
      errors.push(`Contact "${ct.name || "unknown"}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  revalidatePath("/companies");
  revalidatePath("/contacts");
  revalidatePath("/jobs");

  return {
    success: companiesCreated > 0 || companiesUpdated > 0 || contactsCreated > 0 || contactsUpdated > 0,
    companiesCreated,
    companiesUpdated,
    contactsCreated,
    contactsUpdated,
    errors,
  };
}

// ============================================================================
// 3. LINKS DATA EXPORT & IMPORT
// ============================================================================

export interface LinksBackupPayload {
  version: 1;
  type: "links_backup";
  exported_at: string;
  categoriesCount: number;
  linksCount: number;
  shortcutsCount: number;
  categories: LinkCategory[];
  links: SocialLink[];
  shortcuts: QuickShortcut[];
}

export interface LinksImportResult {
  success: boolean;
  categoriesCreated: number;
  linksCreated: number;
  linksUpdated: number;
  shortcutsCreated: number;
  errors: string[];
}

export async function exportLinksData(): Promise<LinksBackupPayload> {
  const { categories, links, shortcuts } = await getLinksAndCategories();

  return {
    version: 1,
    type: "links_backup",
    exported_at: new Date().toISOString(),
    categoriesCount: categories.length,
    linksCount: links.length,
    shortcutsCount: shortcuts.length,
    categories,
    links,
    shortcuts,
  };
}

export async function importLinksFromJson(rawJson: string): Promise<LinksImportResult> {
  const { supabase, userId } = await getUser();
  if (!userId) throw new Error("Unauthorized");

  if (!rawJson || !rawJson.trim()) {
    throw new Error("No JSON content provided.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson.trim());
  } catch {
    throw new Error("Invalid JSON syntax.");
  }

  let rawCategories: Array<Record<string, unknown>> = [];
  let rawLinks: Array<Record<string, unknown>> = [];
  let rawShortcuts: Array<Record<string, unknown>> = [];

  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.categories)) rawCategories = obj.categories as Array<Record<string, unknown>>;
    if (Array.isArray(obj.links)) rawLinks = obj.links as Array<Record<string, unknown>>;
    if (Array.isArray(obj.shortcuts)) rawShortcuts = obj.shortcuts as Array<Record<string, unknown>>;
    if (Array.isArray(parsed)) {
      // Direct array of links
      rawLinks = parsed as Array<Record<string, unknown>>;
    }
  }

  if (rawLinks.length === 0 && rawCategories.length === 0 && rawShortcuts.length === 0) {
    throw new Error("No link or category records found in JSON.");
  }

  let categoriesCreated = 0;
  let linksCreated = 0;
  let linksUpdated = 0;
  let shortcutsCreated = 0;
  const errors: string[] = [];

  // Fetch current local categories
  const { data: localCategories } = await supabase
    .from("link_categories")
    .select("id, name, sort_order")
    .eq("user_id", userId);

  const categoryMap = new Map<string, string>(); // oldId or name -> localId
  (localCategories ?? []).forEach((c) => {
    categoryMap.set((c.name as string).toLowerCase(), c.id as string);
  });

  // 1. Process Categories
  for (const cat of rawCategories) {
    try {
      const name = (cat.name as string)?.trim();
      if (!name) continue;
      const oldId = cat.id as string | undefined;

      if (!categoryMap.has(name.toLowerCase())) {
        const nextOrder = (localCategories?.length ?? 0) + categoriesCreated;
        const res = await createCategory({
          name,
          sort_order: nextOrder,
        });
        if (res.success && res.data) {
          categoryMap.set(name.toLowerCase(), res.data.id);
          if (oldId) categoryMap.set(oldId, res.data.id);
          categoriesCreated++;
        }
      } else if (oldId) {
        categoryMap.set(oldId, categoryMap.get(name.toLowerCase())!);
      }
    } catch (err: unknown) {
      errors.push(`Category "${cat.name}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 2. Process Links
  let defaultCategory = (localCategories ?? [])[0]?.id as string | undefined;
  if (!defaultCategory) {
    defaultCategory = Array.from(categoryMap.values())[0];
  }

  for (const l of rawLinks) {
    try {
      const url = (l.url as string)?.trim();
      const title = (l.title as string)?.trim() || url;
      if (!url) continue;

      let categoryId: string | undefined = undefined;
      if (l.category_id && categoryMap.has(l.category_id as string)) {
        categoryId = categoryMap.get(l.category_id as string);
      } else if (l.categoryName && categoryMap.has((l.categoryName as string).toLowerCase())) {
        categoryId = categoryMap.get((l.categoryName as string).toLowerCase());
      } else if (l.category_name && categoryMap.has((l.category_name as string).toLowerCase())) {
        categoryId = categoryMap.get((l.category_name as string).toLowerCase());
      } else {
        categoryId = defaultCategory;
      }

      if (!categoryId) {
        const res = await createCategory({ name: "Imported Links", sort_order: 99 });
        if (res.success && res.data) {
          categoryId = res.data.id;
          categoryMap.set("imported links", categoryId);
        } else {
          continue;
        }
      }

      const tags = Array.isArray(l.tags) ? l.tags.map(String) : typeof l.tags === "string" ? (l.tags as string).split(",") : [];
      const notes = (l.notes as string) || null;
      const isPinned = Boolean(l.is_pinned);
      const isFavorite = Boolean(l.is_favorite);

      // Check existing by URL for this user
      const { data: existingLink } = await supabase
        .from("social_links")
        .select("id")
        .eq("user_id", userId)
        .eq("url", url)
        .maybeSingle();

      if (existingLink) {
        await supabase
          .from("social_links")
          .update({
            title,
            category_id: categoryId,
            tags,
            notes,
            is_pinned: isPinned ? 1 : 0,
            is_favorite: isFavorite ? 1 : 0,
            updated_at: new Date().toISOString(),
          })
          .eq("id", (existingLink as unknown as { id: string }).id)
          .eq("user_id", userId);
        linksUpdated++;
      } else {
        await createLink({
          title,
          url,
          category_id: categoryId,
          tags,
          notes: notes || undefined,
        });
        linksCreated++;
      }
    } catch (err: unknown) {
      errors.push(`Link "${l.title || l.url}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 3. Process Quick Shortcuts
  for (const s of rawShortcuts) {
    const val = ((s.value as string) || (s.url as string))?.trim();
    const title = (s.title as string)?.trim() || val;
    if (!val) continue;

    try {
      const { data: existingShortcut } = await supabase
        .from("quick_shortcuts")
        .select("id")
        .eq("user_id", userId)
        .eq("value", val)
        .maybeSingle();

      if (!existingShortcut) {
        await createQuickShortcut({
          title,
          value: val,
          icon: (s.icon as string) || undefined,
          sort_order: typeof s.sort_order === "number" ? s.sort_order : 0,
        });
        shortcutsCreated++;
      }
    } catch (err: unknown) {
      errors.push(`Shortcut "${s.title || val}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  revalidatePath("/resources");

  return {
    success: categoriesCreated > 0 || linksCreated > 0 || linksUpdated > 0 || shortcutsCreated > 0,
    categoriesCreated,
    linksCreated,
    linksUpdated,
    shortcutsCreated,
    errors,
  };
}
