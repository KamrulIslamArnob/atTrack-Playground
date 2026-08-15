"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { moduleLogger } from "@/lib/log";
import { requestId } from "@/lib/log/request";
import { logResourceActivity } from "./activity-log";

const log = moduleLogger("actions.companies");

/** job-detail-sheet Company tab — manual enrichment, no AI. */
export async function updateCompany(companyId: string, formData: FormData): Promise<void> {
  const { supabase, userId } = await getUser();

  const website = (formData.get("website") as string) || null;
  const location = (formData.get("location") as string) || null;
  const foundedYearRaw = formData.get("founded_year") as string;
  const foundedYear = foundedYearRaw ? Number(foundedYearRaw) : null;
  const companyType = (formData.get("company_type") as string) || null;
  const country = (formData.get("country") as string) || null;

  const { error } = await supabase
    .from("companies")
    .update({
      website,
      location,
      founded_year: foundedYear,
      company_type: companyType,
      country,
    })
    .eq("id", companyId)
    .eq("user_id", userId);

  if (error) throw new Error("Failed to update company.");

  void logResourceActivity(userId, "company.update", "company", companyId, { fields: "profile" });
  revalidatePath("/jobs");
}

export interface CrmCompany {
  id: string;
  name: string;
  website: string | null;
  location: string | null;
  color: string | null;
  job_count: number;
  contact_count: number;
}

export async function updateCompanyColor(companyId: string, color: string | null): Promise<void> {
  const { supabase, userId } = await getUser();
  const { error } = await supabase
    .from("companies")
    .update({ color })
    .eq("id", companyId)
    .eq("user_id", userId);
  if (error) throw new Error("Failed to update company color.");
  void logResourceActivity(userId, "company.update", "company", companyId, { fields: "color" });
  revalidatePath("/crm");
}

/**
 * Every job already resolves to a companies row by exact name match
 * (createJob's find-or-create), and every contact optionally carries the same
 * company_id — so "which company is common ground" is already true in the
 * data model. This just aggregates it for the CRM's company directory.
 *
 * ponytail: counts computed in memory (single-user data volumes), not via a
 * SQL GROUP BY the query builder doesn't support — fine at this scale.
 */
export async function getCrmCompanies(): Promise<CrmCompany[]> {
  const { supabase, userId } = await getUser();

  const [{ data: companies }, { data: jobs }, { data: contacts }] = await Promise.all([
    supabase.from("companies").select("id, name, website, location, color").eq("user_id", userId).order("name", { ascending: true }),
    supabase.from("jobs").select("company_id").eq("user_id", userId),
    supabase.from("contacts").select("company_id").eq("user_id", userId),
  ]);

  const jobCounts = new Map<string, number>();
  for (const j of jobs ?? []) {
    if (j.company_id) jobCounts.set(j.company_id, (jobCounts.get(j.company_id) ?? 0) + 1);
  }
  const contactCounts = new Map<string, number>();
  for (const c of contacts ?? []) {
    if (c.company_id) contactCounts.set(c.company_id, (contactCounts.get(c.company_id) ?? 0) + 1);
  }

  return (companies ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    website: c.website ?? null,
    location: c.location ?? null,
    color: c.color ?? null,
    job_count: jobCounts.get(c.id) ?? 0,
    contact_count: contactCounts.get(c.id) ?? 0,
  }));
}

export interface CompanyJob {
  id: string;
  title: string;
  status: string;
}

/** CRM company row, expanded — the jobs already tied to this company via jobs.company_id. */
export async function getCompanyJobs(companyId: string): Promise<CompanyJob[]> {
  const { supabase, userId } = await getUser();

  const { data, error } = await supabase
    .from("jobs")
    .select("id, title, status")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) {
    log.error({ err: error, reqId: requestId() }, "Error fetching company jobs:");
    return [];
  }

  return (data ?? []) as unknown as CompanyJob[];
}

/** CRM "+ Add company" — manual entry for a company with no job yet. createJob() still find-or-creates by name, so this never produces a duplicate. */
export async function createCompany(formData: FormData): Promise<{ id: string }> {
  const { supabase, userId } = await getUser();

  const name = (formData.get("name") as string)?.trim();
  if (!name) throw new Error("Company name is required.");

  const { data: existing } = await supabase
    .from("companies")
    .select("id")
    .eq("user_id", userId)
    .eq("name", name)
    .maybeSingle();
  if (existing) return { id: existing.id };

  const { data: company, error } = await supabase
    .from("companies")
    .insert({
      user_id: userId,
      name,
      website: (formData.get("website") as string) || null,
      location: (formData.get("location") as string) || null,
    })
    .select("id")
    .single();

  if (error) throw new Error("Failed to create company.");

  void logResourceActivity(userId, "company.create", "company", company.id);
  revalidatePath("/crm");
  return { id: company.id };
}

/** Edit existing company name, website, and location */
export async function updateCompanyDetails(
  companyId: string,
  formData: FormData
): Promise<CrmCompany> {
  const { supabase, userId } = await getUser();

  const name = (formData.get("name") as string)?.trim();
  if (!name) throw new Error("Company name is required.");

  const website = (formData.get("website") as string)?.trim() || null;
  const location = (formData.get("location") as string)?.trim() || null;

  const { data: updated, error } = await supabase
    .from("companies")
    .update({ name, website, location })
    .eq("id", companyId)
    .eq("user_id", userId)
    .select("id, name, website, location, color")
    .single();

  if (error) throw new Error("Failed to update company.");

  void logResourceActivity(userId, "company.update", "company", companyId, { fields: "details" });
  revalidatePath("/crm");

  const [{ count: jobCount }, { count: contactCount }] = await Promise.all([
    supabase.from("jobs").select("*", { count: "exact", head: true }).eq("user_id", userId).eq("company_id", companyId),
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("user_id", userId).eq("company_id", companyId),
  ]);

  return {
    id: updated.id,
    name: updated.name,
    website: updated.website,
    location: updated.location,
    color: updated.color,
    job_count: jobCount ?? 0,
    contact_count: contactCount ?? 0,
  };
}

/** Delete a company and unlink any associated contacts/jobs */
export async function deleteCompany(companyId: string): Promise<void> {
  const { supabase, userId } = await getUser();

  // Unlink contacts
  await supabase
    .from("contacts")
    .update({ company_id: null })
    .eq("user_id", userId)
    .eq("company_id", companyId);

  // Unlink jobs
  await supabase
    .from("jobs")
    .update({ company_id: null })
    .eq("user_id", userId)
    .eq("company_id", companyId);

  const { error } = await supabase
    .from("companies")
    .delete()
    .eq("id", companyId)
    .eq("user_id", userId);

  if (error) throw new Error("Failed to delete company.");

  void logResourceActivity(userId, "company.delete", "company", companyId);
  revalidatePath("/crm");
}
