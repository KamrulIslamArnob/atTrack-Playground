"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { logResourceActivity } from "@/lib/actions/activity-log";

export interface Contact {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  position: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  notes: string | null;
  company_id: string | null;
  company_name: string | null;
}

interface RawContactRow {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  position: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  notes: string | null;
  company_id: string | null;
  company: { name: string } | null;
}

function toContact(row: RawContactRow): Contact {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    email: row.email,
    phone: row.phone,
    position: row.position,
    linkedin_url: row.linkedin_url,
    github_url: row.github_url,
    notes: row.notes,
    company_id: row.company_id,
    company_name: row.company?.name ?? null,
  };
}

/** The user's whole contact library — for the "+Link Contact" picker. */
export async function getContacts(): Promise<Contact[]> {
  const { supabase, userId } = await getUser();

  const { data, error } = await supabase
    .from("contacts")
    .select("id, name, role, email, phone, position, linkedin_url, github_url, notes, company_id, company:companies(name)")
    .eq("user_id", userId)
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching contacts:", error);
    return [];
  }

  return ((data ?? []) as unknown as RawContactRow[]).map(toContact);
}

export async function getJobContacts(jobId: string): Promise<Contact[]> {
  const { supabase, userId } = await getUser();

  // job_contacts carries no user_id of its own — scope through the job so a
  // stray row from a carried-over multi-user DB can't leak another user's contacts.
  const { data: job } = await supabase.from("jobs").select("id").eq("id", jobId).eq("user_id", userId).maybeSingle();
  if (!job) return [];

  const { data, error } = await supabase
    .from("job_contacts")
    .select("contact:contacts(id, name, role, email, phone, position, linkedin_url, github_url, notes, company_id, company:companies(name))")
    .eq("job_id", jobId);

  if (error) {
    console.error("Error fetching job contacts:", error);
    return [];
  }

  return ((data ?? []) as unknown as { contact: RawContactRow | null }[])
    .map((row) => row.contact)
    .filter((c): c is RawContactRow => c !== null)
    .map(toContact);
}

/** Creates a contact and links it to the job in one step ("+ Create Contact"). */
export async function createContact(
  jobId: string,
  formData: FormData
): Promise<{ id: string }> {
  const { supabase, userId } = await getUser();

  const { data: job } = await supabase.from("jobs").select("id").eq("id", jobId).eq("user_id", userId).single();
  if (!job) throw new Error("Job not found.");

  const name = (formData.get("name") as string)?.trim();
  if (!name) throw new Error("Contact name is required.");

  const { data: contact, error } = await supabase
    .from("contacts")
    .insert({
      user_id: userId,
      name,
      role: (formData.get("role") as string) || null,
      email: (formData.get("email") as string) || null,
      phone: (formData.get("phone") as string) || null,
      position: (formData.get("position") as string) || null,
      linkedin_url: (formData.get("linkedin_url") as string) || null,
      github_url: (formData.get("github_url") as string) || null,
      notes: (formData.get("notes") as string) || null,
    })
    .select("id")
    .single();

  if (error) throw new Error("Failed to create contact.");

  await supabase.from("job_contacts").insert({ job_id: jobId, contact_id: contact.id });

  revalidatePath("/jobs/" + jobId);
  await logResourceActivity(userId, "create", "contact", contact.id, { job_id: jobId, name });
  return { id: contact.id };
}

export async function linkContact(jobId: string, contactId: string): Promise<void> {
  const { supabase, userId } = await getUser();

  const [{ data: job }, { data: contact }] = await Promise.all([
    supabase.from("jobs").select("id").eq("id", jobId).eq("user_id", userId).single(),
    supabase.from("contacts").select("id").eq("id", contactId).eq("user_id", userId).single(),
  ]);
  if (!job || !contact) throw new Error("Job or contact not found.");

  await supabase.from("job_contacts").insert({ job_id: jobId, contact_id: contactId });

  revalidatePath("/jobs/" + jobId);
  await logResourceActivity(userId, "link", "job_contact", contactId, { job_id: jobId });
}

export async function unlinkContact(jobId: string, contactId: string): Promise<void> {
  const { supabase, userId } = await getUser();

  const { data: job } = await supabase.from("jobs").select("id").eq("id", jobId).eq("user_id", userId).single();
  if (!job) throw new Error("Job not found.");

  await supabase.from("job_contacts").delete().eq("job_id", jobId).eq("contact_id", contactId);

  revalidatePath("/jobs/" + jobId);
  await logResourceActivity(userId, "unlink", "job_contact", contactId, { job_id: jobId });
}

export async function updateContact(id: string, formData: FormData): Promise<void> {
  const { supabase, userId } = await getUser();

  const name = (formData.get("name") as string)?.trim();
  if (!name) throw new Error("Contact name is required.");

  const companyId = (formData.get("company_id") as string) || null;
  if (companyId) {
    const { data: company } = await supabase.from("companies").select("id").eq("id", companyId).eq("user_id", userId).single();
    if (!company) throw new Error("Company not found.");
  }

  const { error } = await supabase
    .from("contacts")
    .update({
      name,
      role: (formData.get("role") as string) || null,
      email: (formData.get("email") as string) || null,
      phone: (formData.get("phone") as string) || null,
      position: (formData.get("position") as string) || null,
      linkedin_url: (formData.get("linkedin_url") as string) || null,
      github_url: (formData.get("github_url") as string) || null,
      notes: (formData.get("notes") as string) || null,
      company_id: companyId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw new Error("Failed to update contact.");
  await logResourceActivity(userId, "update", "contact", id, { name });
}

export async function deleteContact(id: string): Promise<void> {
  const { supabase, userId } = await getUser();

  const { error } = await supabase.from("contacts").delete().eq("id", id).eq("user_id", userId);
  if (error) throw new Error("Failed to delete contact.");
  await logResourceActivity(userId, "delete", "contact", id);
}

// --- CRM (/crm) — contacts organized by company, independent of any one job ---

export async function getCompanyContacts(companyId: string): Promise<Contact[]> {
  const { supabase, userId } = await getUser();

  const { data, error } = await supabase
    .from("contacts")
    .select("id, name, role, email, phone, position, linkedin_url, github_url, notes, company_id, company:companies(name)")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching company contacts:", error);
    return [];
  }

  return ((data ?? []) as unknown as RawContactRow[]).map(toContact);
}

/** Contacts not yet attached to any company — the CRM's "link existing" picker draws from here. */
export async function getOrphanContacts(): Promise<Contact[]> {
  const { supabase, userId } = await getUser();

  const { data, error } = await supabase
    .from("contacts")
    .select("id, name, role, email, phone, position, linkedin_url, github_url, notes, company_id, company:companies(name)")
    .eq("user_id", userId)
    .is("company_id", null)
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching orphan contacts:", error);
    return [];
  }

  return ((data ?? []) as unknown as RawContactRow[]).map(toContact);
}

/** CRM "+ Add contact" on a company — no job involved, unlike createContact(). */
export async function createCompanyContact(
  companyId: string,
  formData: FormData
): Promise<{ id: string }> {
  const { supabase, userId } = await getUser();

  const { data: company } = await supabase
    .from("companies")
    .select("id")
    .eq("id", companyId)
    .eq("user_id", userId)
    .single();
  if (!company) throw new Error("Company not found.");

  const name = (formData.get("name") as string)?.trim();
  if (!name) throw new Error("Contact name is required.");

  const { data: contact, error } = await supabase
    .from("contacts")
    .insert({
      user_id: userId,
      name,
      role: (formData.get("role") as string) || "other",
      email: (formData.get("email") as string) || null,
      phone: (formData.get("phone") as string) || null,
      position: (formData.get("position") as string) || null,
      linkedin_url: (formData.get("linkedin_url") as string) || null,
      github_url: (formData.get("github_url") as string) || null,
      notes: (formData.get("notes") as string) || null,
      company_id: companyId,
    })
    .select("id")
    .single();

  if (error) throw new Error("Failed to create contact.");

  revalidatePath("/crm");
  await logResourceActivity(userId, "create", "contact", contact.id, { company_id: companyId, name });
  return { id: contact.id };
}

/** CRM "link existing contact" / tag reassignment — pass null to untag. */
export async function setContactCompany(contactId: string, companyId: string | null): Promise<void> {
  const { supabase, userId } = await getUser();

  const { data: contact } = await supabase.from("contacts").select("id").eq("id", contactId).eq("user_id", userId).single();
  if (!contact) throw new Error("Contact not found.");

  if (companyId) {
    const { data: company } = await supabase.from("companies").select("id").eq("id", companyId).eq("user_id", userId).single();
    if (!company) throw new Error("Company not found.");
  }

  const { error } = await supabase
    .from("contacts")
    .update({ company_id: companyId, updated_at: new Date().toISOString() })
    .eq("id", contactId)
    .eq("user_id", userId);
  if (error) throw new Error("Failed to link contact.");

  revalidatePath("/crm");
  await logResourceActivity(userId, companyId ? "link" : "unlink", "contact", contactId, { company_id: companyId });
}

/** CRM "+ Add contact" from the flat, person-first Contacts view — company is an optional tag, not a container. */
export async function createPersonContact(formData: FormData): Promise<{ id: string }> {
  const { supabase, userId } = await getUser();

  const name = (formData.get("name") as string)?.trim();
  if (!name) throw new Error("Contact name is required.");

  const companyId = (formData.get("company_id") as string) || null;
  if (companyId) {
    const { data: company } = await supabase.from("companies").select("id").eq("id", companyId).eq("user_id", userId).single();
    if (!company) throw new Error("Company not found.");
  }

  const { data: contact, error } = await supabase
    .from("contacts")
    .insert({
      user_id: userId,
      name,
      role: (formData.get("role") as string) || "other",
      email: (formData.get("email") as string) || null,
      phone: (formData.get("phone") as string) || null,
      position: (formData.get("position") as string) || null,
      linkedin_url: (formData.get("linkedin_url") as string) || null,
      github_url: (formData.get("github_url") as string) || null,
      notes: (formData.get("notes") as string) || null,
      company_id: companyId,
    })
    .select("id")
    .single();

  if (error) throw new Error("Failed to create contact.");

  revalidatePath("/crm");
  await logResourceActivity(userId, "create", "contact", contact.id, { company_id: companyId, name });
  return { id: contact.id };
}
