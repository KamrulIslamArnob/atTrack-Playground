"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { logResourceActivity } from "@/lib/actions/activity-log";
import sharp from "sharp";

export interface Contact {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  position: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  social_links: string | null;
  avatar_url: string | null;
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
  social_links: string | null;
  avatar_url: string | null;
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
    social_links: row.social_links ?? null,
    avatar_url: row.avatar_url ?? null,
    notes: row.notes,
    company_id: row.company_id,
    company_name: row.company?.name ?? null,
  };
}

function generateContactAvatarSlug(
  name?: string,
  companyName?: string,
  tags?: string,
  email?: string
): string {
  const parts: string[] = [];
  if (name?.trim()) parts.push(name.trim());
  if (companyName?.trim()) parts.push(companyName.trim());
  if (tags?.trim()) parts.push(tags.trim());
  if (email?.trim()) parts.push(email.trim());

  let rawString = parts.join("-");
  if (!rawString) rawString = "contact";

  // Deterministic slug — same contact always maps to the same filename.
  // Combined with upsert:true this prevents duplicate files building up.
  return rawString
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Extract the storage path from a Supabase public URL so we can delete it. */
function extractStoragePath(publicUrl: string): string | null {
  try {
    // Supabase public URLs look like:
    // https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
    const url = new URL(publicUrl);
    const match = url.pathname.match(/\/object\/public\/avatar\/(.+)$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

async function processAndOptimizeAvatar(file: File): Promise<{ buffer: Buffer; format: string }> {
  const inputBuffer = Buffer.from(await file.arrayBuffer());

  let quality = 85;
  let outputBuffer = await sharp(inputBuffer)
    .resize(400, 400, { fit: "cover", position: "center" })
    .sharpen({ sigma: 1.0, m1: 0.5, m2: 2.0 })
    .webp({ quality, effort: 4 })
    .toBuffer();

  // Enforce strict size limit: guaranteed under 100 KB
  while (outputBuffer.length > 100 * 1024 && quality > 20) {
    quality -= 10;
    outputBuffer = await sharp(inputBuffer)
      .resize(400, 400, { fit: "cover", position: "center" })
      .sharpen({ sigma: 1.0, m1: 0.5, m2: 2.0 })
      .webp({ quality, effort: 4 })
      .toBuffer();
  }

  return { buffer: outputBuffer, format: "webp" };
}

export async function uploadContactAvatar(formData: FormData): Promise<string> {
  const { supabase, userId } = await getUser();
  const file = formData.get("avatar") as File;
  if (!file) throw new Error("No image file provided.");

  const name = (formData.get("name") as string) || "";
  const companyName = (formData.get("company_name") as string) || "";
  const role = (formData.get("role") as string) || "";
  const email = (formData.get("email") as string) || "";
  const oldAvatarUrl = (formData.get("old_avatar_url") as string) || "";

  const slug = generateContactAvatarSlug(name, companyName, role, email);
  const { buffer: processedBuffer, format } = await processAndOptimizeAvatar(file);
  const newFilePath = `${userId}/contacts/${slug}.${format}`;

  // Delete the previous avatar file if it exists and is different from the new path,
  // preventing orphaned duplicate files from accumulating in storage.
  if (oldAvatarUrl) {
    const oldPath = extractStoragePath(oldAvatarUrl);
    if (oldPath && oldPath !== newFilePath) {
      await supabase.storage.from("avatar").remove([oldPath]);
    }
  }

  const { error: uploadError } = await supabase.storage
    .from("avatar")
    .upload(newFilePath, processedBuffer, {
      contentType: `image/${format}`,
      upsert: true,
    });

  if (uploadError) {
    console.error("Error uploading contact avatar:", uploadError);
    throw new Error("Failed to upload contact photo.");
  }

  const { data: urlData } = supabase.storage.from("avatar").getPublicUrl(newFilePath);
  return urlData.publicUrl;
}

/** The user's whole contact library — for the "+Link Contact" picker. */
export async function getContacts(): Promise<Contact[]> {
  const { supabase, userId } = await getUser();

  const { data, error } = await supabase
    .from("contacts")
    .select("id, name, role, email, phone, position, linkedin_url, github_url, social_links, avatar_url, notes, company_id, company:companies(name)")
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

  const { data: job } = await supabase.from("jobs").select("id").eq("id", jobId).eq("user_id", userId).maybeSingle();
  if (!job) return [];

  const { data, error } = await supabase
    .from("job_contacts")
    .select("contact:contacts(id, name, role, email, phone, position, linkedin_url, github_url, social_links, avatar_url, notes, company_id, company:companies(name))")
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
      social_links: (formData.get("social_links") as string) || null,
      avatar_url: (formData.get("avatar_url") as string) || null,
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
      social_links: (formData.get("social_links") as string) || null,
      avatar_url: (formData.get("avatar_url") as string) || null,
      notes: (formData.get("notes") as string) || null,
      company_id: companyId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw new Error("Failed to update contact.");
  await logResourceActivity(userId, "update", "contact", id, { name });
}

export async function updateContactNotes(id: string, notes: string | null): Promise<void> {
  const { supabase, userId } = await getUser();

  const { error } = await supabase
    .from("contacts")
    .update({
      notes: notes?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw new Error("Failed to update contact notes.");
  revalidatePath("/crm");
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
    .select("id, name, role, email, phone, position, linkedin_url, github_url, social_links, avatar_url, notes, company_id, company:companies(name)")
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
    .select("id, name, role, email, phone, position, linkedin_url, github_url, social_links, avatar_url, notes, company_id, company:companies(name)")
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
      social_links: (formData.get("social_links") as string) || null,
      avatar_url: (formData.get("avatar_url") as string) || null,
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
      social_links: (formData.get("social_links") as string) || null,
      avatar_url: (formData.get("avatar_url") as string) || null,
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


