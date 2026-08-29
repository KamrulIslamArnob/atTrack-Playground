"use server";

import { revalidatePath } from "next/cache";
import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { getUser } from "@/lib/auth";
import { getStorageDir } from "@/lib/db/storage";
import { moduleLogger } from "@/lib/log";
import { requestId } from "@/lib/log/request";
import { logActivity, logResourceActivity } from "./activity-log";
import { maybeAutoSync } from "@/lib/actions/cloud-sync";

const log = moduleLogger("actions.contacts");

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

/**
 * A contact as linked to one specific job. `relationship` lives on the
 * job_contacts row, not on the contact — the same person can be the
 * Referral on this job and just an Employee contact on another.
 */
export interface JobContact extends Contact {
  relationship: string | null;
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

const AVATAR_URL_PREFIX = "/api/files/avatar/";

/**
 * Inverse of storage.getPublicUrl() for the avatar bucket, so a replaced avatar
 * can be deleted.
 *
 * This used to parse the value with `new URL()`, left over from when storage was
 * Supabase and the URL was absolute. Local storage returns a *relative* path, so
 * `new URL()` threw `Invalid URL` on every call, the catch swallowed it, and no
 * old avatar was ever removed — they accumulated in the user's data folder
 * forever. Mirror getPublicUrl's encoding instead of re-parsing.
 */
function extractStoragePath(publicUrl: string): string | null {
  const pathPart = publicUrl.replace(/^https?:\/\/[^/]+/, "");
  if (!pathPart.startsWith(AVATAR_URL_PREFIX)) return null;
  const cleanUrl = pathPart.split("?")[0];
  const encoded = cleanUrl.slice(AVATAR_URL_PREFIX.length);
  if (!encoded) return null;
  try {
    return encoded.split("/").map(decodeURIComponent).join("/");
  } catch {
    return null; // malformed percent-encoding
  }
}

async function processContactAvatar(file: File): Promise<{ buffer: Buffer; format: string }> {
  const inputBuffer = Buffer.from(await file.arrayBuffer());
  let ext = (file.name ? file.name.split(".").pop() : "") || "";
  ext = ext.toLowerCase().trim();
  if (ext === "jpg") ext = "jpeg";
  if (!ext && file.type) {
    ext = file.type.replace(/^image\//, "").toLowerCase().replace("svg+xml", "svg");
  }
  const validExts = ["png", "jpeg", "webp", "gif", "svg", "avif", "bmp", "tiff", "tif", "ico", "heic", "heif"];
  if (!validExts.includes(ext)) {
    ext = "png";
  }
  return { buffer: inputBuffer, format: ext };
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
  const randomSuffix = Math.random().toString(36).substring(2, 9);
  const { buffer: processedBuffer, format } = await processContactAvatar(file);
  const newFilePath = `${userId}/contacts/${slug}-${randomSuffix}.${format}`;

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
    log.error({ err: uploadError, reqId: requestId() }, "Error uploading contact avatar:");
    throw new Error("Failed to upload contact photo.");
  }

  const { data: urlData } = supabase.storage.from("avatar").getPublicUrl(newFilePath);
  return `${urlData.publicUrl}?v=${Date.now()}`;
}

/** Open the native OS folder where contact avatar pictures are stored. */
export async function openContactAvatarFolder(avatarUrl?: string | null): Promise<{ success: boolean; path: string }> {
  const { userId } = await getUser();
  let targetFolder = path.join(getStorageDir(), "avatar", userId, "contacts");

  if (avatarUrl) {
    const storageRelPath = extractStoragePath(avatarUrl);
    if (storageRelPath) {
      targetFolder = path.dirname(path.join(getStorageDir(), "avatar", storageRelPath));
    }
  }

  try {
    await mkdir(targetFolder, { recursive: true });

    if (process.platform === "win32") {
      execFile("explorer.exe", [targetFolder]);
    } else if (process.platform === "darwin") {
      execFile("open", [targetFolder]);
    } else {
      execFile("xdg-open", [targetFolder]);
    }
    return { success: true, path: targetFolder };
  } catch (err) {
    log.error({ err, reqId: requestId() }, "Failed to open native contact avatars folder");
    throw new Error("Couldn't open avatar folder.");
  }
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
    log.error({ err: error, reqId: requestId() }, "Error fetching contacts:");
    return [];
  }

  return ((data ?? []) as unknown as RawContactRow[]).map(toContact);
}

export async function getJobContacts(jobId: string): Promise<JobContact[]> {
  const { supabase, userId } = await getUser();

  const { data: job } = await supabase.from("jobs").select("id").eq("id", jobId).eq("user_id", userId).maybeSingle();
  if (!job) return [];

  const { data, error } = await supabase
    .from("job_contacts")
    .select("relationship, contact:contacts(id, name, role, email, phone, position, linkedin_url, github_url, social_links, avatar_url, notes, company_id, company:companies(name))")
    .eq("job_id", jobId);

  if (error) {
    log.error({ err: error, reqId: requestId() }, "Error fetching job contacts:");
    return [];
  }

  return ((data ?? []) as unknown as { relationship: string | null; contact: RawContactRow | null }[])
    .filter((row): row is { relationship: string | null; contact: RawContactRow } => row.contact !== null)
    .map((row) => ({ ...toContact(row.contact), relationship: row.relationship ?? null }));
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

  // A brand-new contact's initial relationship to this job starts out the
  // same as its global role — the two only diverge once the contact gets
  // linked to a second job with a different relationship there.
  const role = (formData.get("role") as string) || null;

  const { data: contact, error } = await supabase
    .from("contacts")
    .insert({
      user_id: userId,
      name,
      role,
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

  await supabase.from("job_contacts").insert({ job_id: jobId, contact_id: contact.id, relationship: role });

  void logResourceActivity(userId, "contact.create", "contact", contact.id, { jobId });
  void maybeAutoSync();

  revalidatePath("/jobs/" + jobId);
  return { id: contact.id };
}

export async function linkContact(jobId: string, contactId: string): Promise<void> {
  const { supabase, userId } = await getUser();

  const [{ data: job }, { data: contact }] = await Promise.all([
    supabase.from("jobs").select("id").eq("id", jobId).eq("user_id", userId).single(),
    supabase.from("contacts").select("id, role").eq("id", contactId).eq("user_id", userId).single(),
  ]);
  if (!job || !contact) throw new Error("Job or contact not found.");

  // Default this job's relationship to the contact's current global role;
  // the user can retag it per-job afterward without touching the contact.
  await supabase.from("job_contacts").insert({ job_id: jobId, contact_id: contactId, relationship: contact.role ?? null });

  revalidatePath("/jobs/" + jobId);
}

export async function unlinkContact(jobId: string, contactId: string): Promise<void> {
  const { supabase, userId } = await getUser();

  const { data: job } = await supabase.from("jobs").select("id").eq("id", jobId).eq("user_id", userId).single();
  if (!job) throw new Error("Job not found.");

  await supabase.from("job_contacts").delete().eq("job_id", jobId).eq("contact_id", contactId);

  revalidatePath("/jobs/" + jobId);
}

/** Retags a contact's relationship on this one job — leaves contacts.role (the
 *  contact's global tag) untouched, so the same person can be "Referral" here
 *  and something else on their other linked jobs. */
export async function updateJobContactRelationship(
  jobId: string,
  contactId: string,
  relationship: string | null
): Promise<void> {
  const { supabase, userId } = await getUser();

  const { data: job } = await supabase.from("jobs").select("id").eq("id", jobId).eq("user_id", userId).single();
  if (!job) throw new Error("Job not found.");

  const { error } = await supabase
    .from("job_contacts")
    .update({ relationship: relationship || null })
    .eq("job_id", jobId)
    .eq("contact_id", contactId);

  if (error) throw new Error("Failed to update relationship.");

  revalidatePath("/jobs/" + jobId);
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

  void logResourceActivity(userId, "contact.update", "contact", id, { companyId });
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
  void logResourceActivity(userId, "contact.update", "contact", id, { fields: "notes" });
  revalidatePath("/crm");
}

export async function deleteContact(id: string): Promise<void> {
  const { supabase, userId } = await getUser();

  const { data: contact } = await supabase
    .from("contacts")
    .select("avatar_url")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (contact?.avatar_url) {
    const oldPath = extractStoragePath(contact.avatar_url);
    if (oldPath) {
      await supabase.storage.from("avatar").remove([oldPath]);
    }
  }

  const { error } = await supabase.from("contacts").delete().eq("id", id).eq("user_id", userId);
  if (error) throw new Error("Failed to delete contact.");

  void logResourceActivity(userId, "contact.delete", "contact", id);
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
    log.error({ err: error, reqId: requestId() }, "Error fetching company contacts:");
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
    log.error({ err: error, reqId: requestId() }, "Error fetching orphan contacts:");
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

  void logResourceActivity(userId, "contact.create", "contact", contact.id, { companyId });
  void maybeAutoSync();

  revalidatePath("/crm");
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

  void logResourceActivity(userId, "contact.update", "contact", contactId, { companyId, fields: "company" });

  revalidatePath("/crm");
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

  void logResourceActivity(userId, "contact.create", "contact", contact.id, { companyId });
  void maybeAutoSync();

  revalidatePath("/crm");
  return { id: contact.id };
}

/** Removes a tag from all contacts that currently have it in their role/tags field. */
export async function deleteTag(tagToDelete: string): Promise<{ affectedCount: number }> {
  const { supabase, userId } = await getUser();
  const targetTag = tagToDelete.trim();
  if (!targetTag) return { affectedCount: 0 };

  const { data: contacts, error } = await supabase
    .from("contacts")
    .select("id, role")
    .eq("user_id", userId);

  if (error || !contacts) throw new Error("Failed to fetch contacts for tag deletion.");

  let affectedCount = 0;
  for (const c of contacts) {
    if (!c.role) continue;
    const currentTags = c.role.split(",").map((t: string) => t.trim()).filter(Boolean);
    if (currentTags.some((t: string) => t.toLowerCase() === targetTag.toLowerCase())) {
      const remainingTags = currentTags.filter((t: string) => t.toLowerCase() !== targetTag.toLowerCase());
      const newRole = remainingTags.length > 0 ? remainingTags.join(", ") : null;

      await supabase
        .from("contacts")
        .update({ role: newRole })
        .eq("id", c.id)
        .eq("user_id", userId);

      affectedCount++;
    }
  }

  // Tag text is the user's own wording, so only the count travels.
  void logActivity(userId, "contact.tag.delete", { affectedCount });

  revalidatePath("/crm");
  return { affectedCount };
}

/** Renames a tag across all contacts. */
export async function renameTag(oldTag: string, newTag: string): Promise<{ affectedCount: number }> {
  const { supabase, userId } = await getUser();
  const source = oldTag.trim();
  const target = newTag.trim();
  if (!source || !target || source.toLowerCase() === target.toLowerCase()) {
    return { affectedCount: 0 };
  }

  const { data: contacts, error } = await supabase
    .from("contacts")
    .select("id, role")
    .eq("user_id", userId);

  if (error || !contacts) throw new Error("Failed to fetch contacts for tag rename.");

  let affectedCount = 0;
  for (const c of contacts) {
    if (!c.role) continue;
    const currentTags = c.role.split(",").map((t: string) => t.trim()).filter(Boolean);
    if (currentTags.some((t: string) => t.toLowerCase() === source.toLowerCase())) {
      const updatedTags = currentTags.map((t: string) =>
        t.toLowerCase() === source.toLowerCase() ? target : t
      );
      const uniqueTags = Array.from(new Set(updatedTags));
      const newRole = uniqueTags.join(", ");

      await supabase
        .from("contacts")
        .update({ role: newRole })
        .eq("id", c.id)
        .eq("user_id", userId);

      affectedCount++;
    }
  }

  void logActivity(userId, "contact.tag.rename", { affectedCount });

  revalidatePath("/crm");
  return { affectedCount };
}

/** Returns all unique tags across all user contacts. */
export async function getAllUserTags(): Promise<string[]> {
  const { supabase, userId } = await getUser();

  const { data: contacts } = await supabase
    .from("contacts")
    .select("role")
    .eq("user_id", userId);

  const tagSet = new Set<string>();

  (contacts ?? []).forEach((c) => {
    if (c.role) {
      c.role.split(",").forEach((t: string) => {
        const trimmed = t.trim();
        if (trimmed) tagSet.add(trimmed);
      });
    }
  });

  return Array.from(tagSet).sort((a, b) => a.localeCompare(b));
}


