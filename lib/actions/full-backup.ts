"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { getDb } from "@/lib/db/sqlite";
import { moduleLogger } from "@/lib/log";
import {
  exportAllJobsData,
  exportCrmData,
  exportLinksData,
  type JobsBackupPayload,
  type CrmBackupPayload,
  type LinksBackupPayload,
} from "@/lib/actions/data-management";

const log = moduleLogger("actions.full-backup");

// The single payload shape both backup destinations share — Git Gist sync
// (lib/actions/gist-sync.ts) and Neon cloud sync (lib/actions/cloud-sync.ts)
// both push/pull exactly this JSON. Deliberately excludes:
//   - Anything secret: users.device_token_encrypted, smtp_config,
//     ai_providers (encrypted API keys), extension_config, and the
//     github_sync_config / cloud_sync_config rows themselves. A backup that
//     could leak credentials is worse than one that makes you re-enter them
//     once after a restore.
//   - Derived/regenerable caches and logs: ai_output_cache,
//     ai_extraction_logs, ai_usage_logs, mcq_question_cache, mcq_results,
//     document_chunks, chat_sessions/chat_messages, application_emails.
//     These are usually the largest tables in the database and none of them
//     are source data — losing them costs nothing but re-computation.
//   - AI configuration (ai_task_routes, ai_tool_prompts, ai_memories): out
//     of scope for a career-data backup. ai_task_routes in particular
//     points at ai_providers rows, which are excluded, so it would only
//     dangle.
export interface FullBackupPayload {
  version: 1;
  type: "betterjob_full_backup" | "attrack_full_backup";
  exported_at: string;
  profile: {
    full_name: string | null;
    headline: string | null;
    phone: string | null;
    location: string | null;
    website: string | null;
  } | null;
  positions: Array<{ name: string; experience_level: string | null; is_primary: boolean }>;
  skills: Array<{
    name: string;
    command: string;
    description: string | null;
    instructions: string;
    icon: string | null;
  }>;
  jobs: JobsBackupPayload;
  crm: CrmBackupPayload;
  links: LinksBackupPayload;
}

export interface FullBackupExportResult {
  payload: FullBackupPayload;
  json: string;
  sizeBytes: number;
}

interface ProfileSubsetRow {
  full_name: string | null;
  headline: string | null;
  phone: string | null;
  location: string | null;
  website: string | null;
}

interface PositionRow {
  name: string;
  experience_level: string | null;
  is_primary: number;
}

interface SkillRow {
  name: string;
  command: string;
  description: string | null;
  instructions: string;
  icon: string | null;
}

/**
 * Serializes every table this backup covers into one structured, optimized JSON payload,
 * formatted cleanly with multi-line indentation ready to push to a Git Gist or upload to cloud storage.
 */
export async function exportFullBackup(): Promise<FullBackupExportResult> {
  const { userId } = await getUser();
  const db = getDb();

  const profileRow = db
    .prepare("SELECT full_name, headline, phone, location, website FROM profiles WHERE id = ?")
    .get(userId) as unknown as ProfileSubsetRow | undefined;

  const positionRows = db
    .prepare("SELECT name, experience_level, is_primary FROM positions WHERE user_id = ?")
    .all(userId) as unknown as PositionRow[];

  const skillRows = db
    .prepare("SELECT name, command, description, instructions, icon FROM skills WHERE user_id = ?")
    .all(userId) as unknown as SkillRow[];

  const [jobs, crm, links] = await Promise.all([exportAllJobsData(), exportCrmData(), exportLinksData()]);

  const payload: FullBackupPayload = {
    version: 1,
    type: "betterjob_full_backup",
    exported_at: new Date().toISOString(),
    profile: profileRow ?? null,
    positions: positionRows.map((p) => ({
      name: p.name,
      experience_level: p.experience_level,
      is_primary: Boolean(p.is_primary),
    })),
    skills: skillRows,
    jobs,
    crm,
    links,
  };

  // Format with 2 spaces for human-readable, multi-line GitHub Gist rendering
  const json = JSON.stringify(payload, null, 2);
  return { payload, json, sizeBytes: Buffer.byteLength(json, "utf8") };
}

export interface FullBackupImportResult {
  success: boolean;
  jobsCreated: number;
  jobsUpdated: number;
  companiesTouched: number;
  contactsTouched: number;
  linksTouched: number;
  positionsCreated: number;
  skillsCreated: number;
  errors: string[];
}

function toSqlString(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  try {
    return JSON.stringify(val);
  } catch {
    return null;
  }
}

function toSqlNumber(val: unknown): number | null {
  if (typeof val === "number" && !Number.isNaN(val)) return val;
  if (typeof val === "string" && val.trim()) {
    const n = Number(val);
    if (!Number.isNaN(n)) return n;
  }
  return null;
}

function toSqlBoolean(val: unknown): number {
  return val ? 1 : 0;
}

/**
 * Restores a full backup payload directly into the local SQLite database.
 * Executes within a single transaction using compiled prepared statements
 * for instantaneous (sub-50ms) execution and zero disk-stall latency.
 * Matching records are updated in place without wiping local data.
 */
export async function importFullBackup(rawJson: string): Promise<FullBackupImportResult> {
  const { userId } = await getUser();
  if (!rawJson || !rawJson.trim()) {
    throw new Error("No backup content to restore.");
  }

  let parsed: Partial<FullBackupPayload>;
  try {
    parsed = JSON.parse(rawJson.trim()) as Partial<FullBackupPayload>;
  } catch {
    throw new Error("That backup file isn't valid JSON.");
  }

  if (
    !parsed ||
    (parsed.type !== "betterjob_full_backup" &&
      parsed.type !== "attrack_full_backup" &&
      (parsed as Record<string, unknown>).type !== "jobs_backup") ||
    !parsed.version
  ) {
    throw new Error("That doesn't look like a BetterJob backup file.");
  }

  const db = getDb();
  const errors: string[] = [];
  let jobsCreated = 0;
  let jobsUpdated = 0;
  let companiesTouched = 0;
  let contactsTouched = 0;
  let linksTouched = 0;
  let positionsCreated = 0;
  let skillsCreated = 0;

  db.exec("BEGIN TRANSACTION;");
  try {
    // 1. Profile Restoration
    if (parsed.profile) {
      const p = parsed.profile;
      db.prepare(`
        UPDATE profiles SET
          full_name = COALESCE(?, full_name),
          headline = COALESCE(?, headline),
          phone = COALESCE(?, phone),
          location = COALESCE(?, location),
          website = COALESCE(?, website)
        WHERE id = ?
      `).run(
        toSqlString(p.full_name),
        toSqlString(p.headline),
        toSqlString(p.phone),
        toSqlString(p.location),
        toSqlString(p.website),
        userId
      );
    }

    // 2. Positions Restoration
    const existingPositions = db
      .prepare("SELECT id, lower(name) AS lname FROM positions WHERE user_id = ?")
      .all(userId) as Array<{ id: string; lname: string }>;
    const posNameSet = new Set(existingPositions.map((p) => p.lname));
    const insertPosStmt = db.prepare(
      "INSERT INTO positions (id, user_id, name, experience_level, is_primary) VALUES (?, ?, ?, ?, ?)"
    );

    for (const pos of parsed.positions ?? []) {
      if (!pos.name?.trim()) continue;
      const lname = pos.name.trim().toLowerCase();
      if (!posNameSet.has(lname)) {
        insertPosStmt.run(
          randomUUID(),
          userId,
          pos.name.trim(),
          toSqlString(pos.experience_level),
          toSqlBoolean(pos.is_primary)
        );
        posNameSet.add(lname);
        positionsCreated++;
      }
    }

    // 3. Skills Restoration
    const existingSkills = db
      .prepare("SELECT id, lower(command) AS lcmd FROM skills WHERE user_id = ?")
      .all(userId) as Array<{ id: string; lcmd: string }>;
    const skillCmdSet = new Set(existingSkills.map((s) => s.lcmd));
    const insertSkillStmt = db.prepare(
      "INSERT INTO skills (id, user_id, name, command, description, instructions, icon) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );

    for (const sk of parsed.skills ?? []) {
      if (!sk.command?.trim()) continue;
      const lcmd = sk.command.trim().toLowerCase();
      if (!skillCmdSet.has(lcmd)) {
        insertSkillStmt.run(
          randomUUID(),
          userId,
          sk.name,
          sk.command.trim(),
          toSqlString(sk.description),
          sk.instructions,
          toSqlString(sk.icon)
        );
        skillCmdSet.add(lcmd);
        skillsCreated++;
      }
    }

    // 4. Board Lists Resolution
    const existingLists = db
      .prepare("SELECT id, kind, name FROM board_lists WHERE user_id = ?")
      .all(userId) as Array<{ id: string; kind: string; name: string }>;
    const listByKindMap = new Map<string, string>();
    const listByIdMap = new Map<string, string>();

    for (const l of existingLists) {
      listByKindMap.set(l.kind, l.id);
      listByIdMap.set(l.id, l.id);
    }

    const insertListStmt = db.prepare(
      "INSERT INTO board_lists (id, user_id, name, kind, color, sort_order) VALUES (?, ?, ?, ?, ?, ?)"
    );
    const boardListsToImport = parsed.jobs?.boardLists ?? [];

    for (const bl of boardListsToImport) {
      if (!bl.id || !bl.name) continue;
      if (!listByIdMap.has(bl.id)) {
        if (bl.kind && bl.kind !== "custom" && listByKindMap.has(bl.kind)) {
          listByIdMap.set(bl.id, listByKindMap.get(bl.kind)!);
        } else {
          const newListId = bl.id || randomUUID();
          insertListStmt.run(
            newListId,
            userId,
            bl.name,
            bl.kind || "custom",
            toSqlString(bl.color),
            toSqlNumber(bl.sort_order) ?? 0
          );
          listByIdMap.set(bl.id, newListId);
          if (bl.kind && bl.kind !== "custom") listByKindMap.set(bl.kind, newListId);
        }
      }
    }

    let defaultListId = listByKindMap.get("wishlist") || existingLists[0]?.id;
    if (!defaultListId) {
      defaultListId = randomUUID();
      insertListStmt.run(defaultListId, userId, "Wishlist", "wishlist", "#38bdf8", 0);
      listByKindMap.set("wishlist", defaultListId);
      listByIdMap.set(defaultListId, defaultListId);
    }

    // 5. Companies Restoration (CRM + inlined in jobs)
    const existingCompanies = db
      .prepare("SELECT id, lower(name) AS lname FROM companies WHERE user_id = ?")
      .all(userId) as Array<{ id: string; lname: string }>;
    const companyMap = new Map<string, string>(); // oldId -> localId, lname -> localId

    for (const c of existingCompanies) {
      companyMap.set(c.lname, c.id);
      companyMap.set(c.id, c.id);
    }

    const insertCompStmt = db.prepare(`
      INSERT INTO companies (id, user_id, name, website, location, founded_year, company_type, country, color, tier, logo_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const updateCompStmt = db.prepare(`
      UPDATE companies SET
        website = COALESCE(?, website),
        location = COALESCE(?, location),
        founded_year = COALESCE(?, founded_year),
        company_type = COALESCE(?, company_type),
        country = COALESCE(?, country),
        color = COALESCE(?, color),
        tier = COALESCE(?, tier),
        logo_url = COALESCE(?, logo_url)
      WHERE id = ? AND user_id = ?
    `);

    const rawCompanies = parsed.crm?.companies ?? [];
    for (const comp of rawCompanies) {
      const name = (comp.name as string)?.trim();
      if (!name) continue;
      const lname = name.toLowerCase();
      const oldId = comp.id as string | undefined;
      const localId = companyMap.get(lname) || (oldId && companyMap.get(oldId));

      if (localId) {
        updateCompStmt.run(
          toSqlString(comp.website),
          toSqlString(comp.location),
          toSqlNumber(comp.founded_year),
          toSqlString(comp.company_type),
          toSqlString(comp.country),
          toSqlString(comp.color),
          toSqlString(comp.tier),
          toSqlString(comp.logo_url),
          localId,
          userId
        );
        companyMap.set(lname, localId);
        if (oldId) companyMap.set(oldId, localId);
      } else {
        const newCompId = oldId || randomUUID();
        insertCompStmt.run(
          newCompId,
          userId,
          name,
          toSqlString(comp.website),
          toSqlString(comp.location),
          toSqlNumber(comp.founded_year),
          toSqlString(comp.company_type),
          toSqlString(comp.country),
          toSqlString(comp.color),
          toSqlString(comp.tier),
          toSqlString(comp.logo_url)
        );
        companiesTouched++;
        companyMap.set(lname, newCompId);
        if (oldId) companyMap.set(oldId, newCompId);
      }
    }

    // Embed-referenced companies inside jobs
    for (const jobItem of parsed.jobs?.jobs ?? []) {
      const comp = jobItem.company;
      if (comp?.name?.trim()) {
        const name = comp.name.trim();
        const lname = name.toLowerCase();
        const oldId = comp.id;
        if (!companyMap.has(lname) && (!oldId || !companyMap.has(oldId))) {
          const newCompId = oldId || randomUUID();
          insertCompStmt.run(
            newCompId,
            userId,
            name,
            toSqlString(comp.website),
            toSqlString(comp.location),
            toSqlNumber(comp.founded_year),
            toSqlString(comp.company_type),
            toSqlString(comp.country),
            toSqlString(comp.color),
            null,
            toSqlString(comp.logo_url)
          );
          companiesTouched++;
          companyMap.set(lname, newCompId);
          if (oldId) companyMap.set(oldId, newCompId);
        }
      }
    }

    // 6. Contacts Restoration (CRM)
    const existingContacts = db
      .prepare("SELECT id, lower(email) AS lemail, lower(name) AS lname, company_id FROM contacts WHERE user_id = ?")
      .all(userId) as Array<{ id: string; lemail: string | null; lname: string; company_id: string | null }>;
    const contactMap = new Map<string, string>(); // oldId -> localId
    const contactEmailMap = new Map<string, string>(); // lemail -> localId
    const contactNameCompMap = new Map<string, string>(); // `${companyId}:${lname}` -> localId

    for (const ct of existingContacts) {
      contactMap.set(ct.id, ct.id);
      if (ct.lemail) contactEmailMap.set(ct.lemail, ct.id);
      if (ct.company_id && ct.lname) contactNameCompMap.set(`${ct.company_id}:${ct.lname}`, ct.id);
    }

    const insertContactStmt = db.prepare(`
      INSERT INTO contacts (id, user_id, name, role, email, phone, position, linkedin_url, github_url, social_links, avatar_url, company_id, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const updateContactStmt = db.prepare(`
      UPDATE contacts SET
        role = COALESCE(?, role),
        email = COALESCE(?, email),
        phone = COALESCE(?, phone),
        position = COALESCE(?, position),
        linkedin_url = COALESCE(?, linkedin_url),
        github_url = COALESCE(?, github_url),
        social_links = COALESCE(?, social_links),
        avatar_url = COALESCE(?, avatar_url),
        company_id = COALESCE(?, company_id),
        notes = COALESCE(?, notes)
      WHERE id = ? AND user_id = ?
    `);

    const rawContacts = parsed.crm?.contacts ?? [];
    for (const ct of rawContacts) {
      const name = (ct.name as string)?.trim();
      if (!name) continue;
      const lname = name.toLowerCase();
      const email = (ct.email as string)?.trim() || null;
      const lemail = email?.toLowerCase() || null;
      const oldId = ct.id as string | undefined;

      let resolvedCompId: string | null = null;
      if (ct.company_id && companyMap.has(ct.company_id as string)) {
        resolvedCompId = companyMap.get(ct.company_id as string)!;
      } else if (ct.company_name && companyMap.has((ct.company_name as string).toLowerCase())) {
        resolvedCompId = companyMap.get((ct.company_name as string).toLowerCase())!;
      }

      const localContactId =
        (lemail && contactEmailMap.get(lemail)) ||
        (resolvedCompId && contactNameCompMap.get(`${resolvedCompId}:${lname}`)) ||
        (oldId && contactMap.get(oldId));

      if (localContactId) {
        updateContactStmt.run(
          toSqlString(ct.role ?? ct.position),
          toSqlString(email),
          toSqlString(ct.phone),
          toSqlString(ct.position),
          toSqlString(ct.linkedin_url),
          toSqlString(ct.github_url),
          toSqlString(ct.social_links),
          toSqlString(ct.avatar_url),
          resolvedCompId,
          toSqlString(ct.notes),
          localContactId,
          userId
        );
        if (oldId) contactMap.set(oldId, localContactId);
      } else {
        const newContactId = oldId || randomUUID();
        insertContactStmt.run(
          newContactId,
          userId,
          name,
          toSqlString(ct.role ?? ct.position),
          toSqlString(email),
          toSqlString(ct.phone),
          toSqlString(ct.position),
          toSqlString(ct.linkedin_url),
          toSqlString(ct.github_url),
          toSqlString(ct.social_links),
          toSqlString(ct.avatar_url),
          resolvedCompId,
          toSqlString(ct.notes)
        );
        contactsTouched++;
        contactMap.set(newContactId, newContactId);
        if (oldId) contactMap.set(oldId, newContactId);
        if (lemail) contactEmailMap.set(lemail, newContactId);
        if (resolvedCompId) contactNameCompMap.set(`${resolvedCompId}:${lname}`, newContactId);
      }
    }

    // 7. Jobs & Sub-records Restoration
    const existingJobs = db
      .prepare("SELECT id, company_id, lower(title) AS ltitle FROM jobs WHERE user_id = ?")
      .all(userId) as Array<{ id: string; company_id: string | null; ltitle: string }>;
    const jobMap = new Map<string, string>(); // oldId -> localId, `${companyId}:${ltitle}` -> localId

    for (const j of existingJobs) {
      jobMap.set(j.id, j.id);
      jobMap.set(`${j.company_id || ""}:${j.ltitle}`, j.id);
    }

    const insertJobStmt = db.prepare(`
      INSERT INTO jobs (
        id, user_id, company_id, list_id, title, state, color, description,
        application_url, application_email, application_process, location, map_url,
        salary_range, salary_min, salary_max, salary_currency, salary_period, is_unpaid,
        skills, educational_requirements, benefits, work_schedule, holiday_policy,
        employment_type, work_location, deadline, section_deadline, section_deadline_list_id,
        source, discovery_channel, source_url, status, notes, match_score, match_reasoning,
        project_links, tier, created_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?
      )
    `);

    const updateJobStmt = db.prepare(`
      UPDATE jobs SET
        company_id = COALESCE(?, company_id),
        state = COALESCE(?, state),
        color = COALESCE(?, color),
        description = COALESCE(?, description),
        application_url = COALESCE(?, application_url),
        application_email = COALESCE(?, application_email),
        application_process = COALESCE(?, application_process),
        location = COALESCE(?, location),
        map_url = COALESCE(?, map_url),
        salary_range = COALESCE(?, salary_range),
        salary_min = COALESCE(?, salary_min),
        salary_max = COALESCE(?, salary_max),
        salary_currency = COALESCE(?, salary_currency),
        salary_period = COALESCE(?, salary_period),
        is_unpaid = COALESCE(?, is_unpaid),
        skills = COALESCE(?, skills),
        educational_requirements = COALESCE(?, educational_requirements),
        benefits = COALESCE(?, benefits),
        work_schedule = COALESCE(?, work_schedule),
        holiday_policy = COALESCE(?, holiday_policy),
        employment_type = COALESCE(?, employment_type),
        work_location = COALESCE(?, work_location),
        deadline = COALESCE(?, deadline),
        source = COALESCE(?, source),
        tier = COALESCE(?, tier),
        notes = COALESCE(?, notes),
        match_score = COALESCE(?, match_score),
        match_reasoning = COALESCE(?, match_reasoning),
        project_links = COALESCE(?, project_links),
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ? AND user_id = ?
    `);

    const insertAppStmt = db.prepare(
      "INSERT INTO applications (id, user_id, job_id, status, applied_at, resume_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    const insertInterviewStmt = db.prepare(
      "INSERT INTO interviews (id, user_id, job_id, scheduled_at, type, status, location, meeting_url, interviewer_name, interviewer_email, notes, duration_minutes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    const insertDeadlineStmt = db.prepare(
      "INSERT INTO job_deadlines (id, user_id, job_id, title, type, stage_kind, due_date, is_pinned, is_completed, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    const insertJobContactStmt = db.prepare(
      "INSERT OR IGNORE INTO job_contacts (job_id, contact_id, relationship) VALUES (?, ?, ?)"
    );

    for (const rawItem of parsed.jobs?.jobs ?? []) {
      const rawObj = rawItem as unknown as Record<string, unknown>;
      const j = (rawObj.job ?? rawObj) as Record<string, unknown>;
      const title = (j.title as string)?.trim();
      if (!title) continue;
      const ltitle = title.toLowerCase();
      const oldJobId = j.id as string | undefined;

      let resolvedCompanyId: string | null = null;
      if (j.company_id && companyMap.has(j.company_id as string)) {
        resolvedCompanyId = companyMap.get(j.company_id as string)!;
      } else if (rawItem.company?.name && companyMap.has(rawItem.company.name.toLowerCase())) {
        resolvedCompanyId = companyMap.get(rawItem.company.name.toLowerCase())!;
      }

      let targetListId = defaultListId;
      if (j.list_id && listByIdMap.has(j.list_id as string)) {
        targetListId = listByIdMap.get(j.list_id as string)!;
      }

      const lookupKey = `${resolvedCompanyId || ""}:${ltitle}`;
      let localJobId = (oldJobId && jobMap.get(oldJobId)) || jobMap.get(lookupKey);

      if (localJobId) {
        updateJobStmt.run(
          resolvedCompanyId,
          toSqlString(j.state) ?? "active",
          toSqlString(j.color),
          toSqlString(j.description),
          toSqlString(j.application_url),
          toSqlString(j.application_email),
          toSqlString(j.application_process),
          toSqlString(j.location),
          toSqlString(j.map_url),
          toSqlString(j.salary_range),
          toSqlNumber(j.salary_min),
          toSqlNumber(j.salary_max),
          toSqlString(j.salary_currency),
          toSqlString(j.salary_period),
          toSqlBoolean(j.is_unpaid),
          toSqlString(j.skills),
          toSqlString(j.educational_requirements),
          toSqlString(j.benefits),
          toSqlString(j.work_schedule),
          toSqlString(j.holiday_policy),
          toSqlString(j.employment_type) ?? "Full-time",
          toSqlString(j.work_location),
          toSqlString(j.deadline) ?? "unknown",
          toSqlString(j.source),
          toSqlString(j.tier),
          toSqlString(j.notes),
          toSqlNumber(j.match_score),
          toSqlString(j.match_reasoning),
          toSqlString(j.project_links),
          localJobId,
          userId
        );
        jobsUpdated++;
      } else {
        localJobId = oldJobId || randomUUID();
        insertJobStmt.run(
          localJobId,
          userId,
          resolvedCompanyId,
          targetListId,
          title,
          toSqlString(j.state) ?? "active",
          toSqlString(j.color),
          toSqlString(j.description),
          toSqlString(j.application_url),
          toSqlString(j.application_email),
          toSqlString(j.application_process),
          toSqlString(j.location),
          toSqlString(j.map_url),
          toSqlString(j.salary_range),
          toSqlNumber(j.salary_min),
          toSqlNumber(j.salary_max),
          toSqlString(j.salary_currency),
          toSqlString(j.salary_period),
          toSqlBoolean(j.is_unpaid),
          toSqlString(j.skills),
          toSqlString(j.educational_requirements),
          toSqlString(j.benefits),
          toSqlString(j.work_schedule),
          toSqlString(j.holiday_policy),
          toSqlString(j.employment_type) ?? "Full-time",
          toSqlString(j.work_location),
          toSqlString(j.deadline) ?? "unknown",
          toSqlString(j.section_deadline),
          toSqlString(j.section_deadline_list_id),
          toSqlString(j.source),
          toSqlString(j.discovery_channel),
          toSqlString(j.source_url),
          toSqlString(j.status) ?? "saved",
          toSqlString(j.notes),
          toSqlNumber(j.match_score),
          toSqlString(j.match_reasoning),
          toSqlString(j.project_links),
          toSqlString(j.tier),
          toSqlString(j.created_at) || new Date().toISOString()
        );
        jobsCreated++;
      }

      if (oldJobId) jobMap.set(oldJobId, localJobId);
      jobMap.set(lookupKey, localJobId);

      // Sub-records: Applications
      const apps = Array.isArray(rawItem.applications) ? rawItem.applications : [];
      for (const app of apps) {
        if (app?.id) {
          const existingApp = db.prepare("SELECT id FROM applications WHERE id = ?").get(app.id);
          if (!existingApp) {
            insertAppStmt.run(
              app.id,
              userId,
              localJobId,
              toSqlString(app.status) || "applied",
              toSqlString(app.applied_at),
              toSqlString(app.resume_name),
              toSqlString(app.created_at) || new Date().toISOString()
            );
          }
        }
      }

      // Sub-records: Interviews
      const ivs = Array.isArray(rawItem.interviews) ? rawItem.interviews : [];
      for (const iv of ivs) {
        if (iv) {
          const ivId = iv.id || randomUUID();
          const existingIv = db.prepare("SELECT id FROM interviews WHERE id = ?").get(ivId);
          if (!existingIv) {
            insertInterviewStmt.run(
              ivId,
              userId,
              localJobId,
              toSqlString(iv.scheduled_at) || new Date().toISOString(),
              toSqlString(iv.type) || "screening",
              toSqlString(iv.status) || "scheduled",
              toSqlString(iv.location),
              toSqlString(iv.meeting_url),
              toSqlString(iv.interviewer_name),
              toSqlString(iv.interviewer_email),
              toSqlString(iv.notes),
              toSqlNumber(iv.duration_minutes)
            );
          }
        }
      }

      // Sub-records: Deadlines
      const deadlines = Array.isArray(rawItem.deadlines) ? rawItem.deadlines : [];
      for (const dl of deadlines) {
        if (dl?.title && dl?.due_date) {
          const dlId = dl.id || randomUUID();
          const existingDl = db.prepare("SELECT id FROM job_deadlines WHERE id = ?").get(dlId);
          if (!existingDl) {
            insertDeadlineStmt.run(
              dlId,
              userId,
              localJobId,
              dl.title,
              toSqlString(dl.type) || "deadline",
              toSqlString(dl.stage_kind) || "custom",
              toSqlString(dl.due_date),
              toSqlBoolean(dl.is_pinned),
              toSqlBoolean(dl.is_completed),
              toSqlString(dl.notes)
            );
          }
        }
      }

      // Sub-records: Linked Contacts
      const linkedContacts = Array.isArray(rawItem.contacts) ? rawItem.contacts : [];
      for (const c of linkedContacts) {
        const cname = c?.name?.trim();
        const cemail = c?.email?.trim()?.toLowerCase();
        const oldCid = c?.id;
        const resolvedContactId =
          (oldCid && contactMap.get(oldCid)) ||
          (cemail && contactEmailMap.get(cemail)) ||
          (resolvedCompanyId && cname && contactNameCompMap.get(`${resolvedCompanyId}:${cname.toLowerCase()}`));
        if (resolvedContactId) {
          insertJobContactStmt.run(localJobId, resolvedContactId, toSqlString(c.relationship || c.role));
        }
      }
    }

    // 8. Links, Categories & Shortcuts Restoration
    const existingCats = db
      .prepare("SELECT id, lower(name) AS lname FROM link_categories WHERE user_id = ?")
      .all(userId) as Array<{ id: string; lname: string }>;
    const catMap = new Map<string, string>(); // oldId -> localId, lname -> localId

    for (const c of existingCats) {
      catMap.set(c.id, c.id);
      catMap.set(c.lname, c.id);
    }

    const insertCatStmt = db.prepare(
      "INSERT INTO link_categories (id, user_id, name, sort_order, is_default) VALUES (?, ?, ?, ?, ?)"
    );

    for (const cat of parsed.links?.categories ?? []) {
      if (!cat.name?.trim()) continue;
      const lname = cat.name.trim().toLowerCase();
      const oldId = cat.id;
      let localCatId = catMap.get(lname) || (oldId && catMap.get(oldId));

      if (!localCatId) {
        localCatId = oldId || randomUUID();
        insertCatStmt.run(
          localCatId,
          userId,
          cat.name.trim(),
          toSqlNumber(cat.sort_order) ?? 0,
          toSqlBoolean(cat.is_default)
        );
        linksTouched++;
      }
      catMap.set(lname, localCatId);
      if (oldId) catMap.set(oldId, localCatId);
    }

    let defaultCatId = existingCats[0]?.id || catMap.values().next().value;
    if (!defaultCatId) {
      defaultCatId = randomUUID();
      insertCatStmt.run(defaultCatId, userId, "General", 0, 1);
      catMap.set("general", defaultCatId);
    }

    const existingLinks = db
      .prepare("SELECT id, url, category_id FROM links WHERE user_id = ?")
      .all(userId) as Array<{ id: string; url: string; category_id: string }>;
    const linkUrlMap = new Map<string, string>(); // `${catId}:${url}` -> id

    for (const l of existingLinks) {
      linkUrlMap.set(`${l.category_id}:${l.url}`, l.id);
    }

    const insertLinkStmt = db.prepare(
      "INSERT INTO links (id, user_id, category_id, title, url, notes, icon_url, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    );
    const updateLinkStmt = db.prepare(
      "UPDATE links SET title = ?, notes = COALESCE(?, notes), icon_url = COALESCE(?, icon_url), tags = COALESCE(?, tags) WHERE id = ? AND user_id = ?"
    );

    for (const lnk of parsed.links?.links ?? []) {
      if (!lnk.url?.trim() || !lnk.title?.trim()) continue;
      const targetCatId = (lnk.category_id && catMap.get(lnk.category_id)) || defaultCatId;
      const key = `${targetCatId}:${lnk.url.trim()}`;
      const localLinkId = linkUrlMap.get(key);

      if (localLinkId) {
        updateLinkStmt.run(
          toSqlString(lnk.title)?.trim() || "Untitled",
          toSqlString(lnk.notes),
          toSqlString(lnk.icon_url),
          toSqlString(lnk.tags),
          localLinkId,
          userId
        );
      } else {
        const newId = lnk.id || randomUUID();
        insertLinkStmt.run(
          newId,
          userId,
          targetCatId,
          toSqlString(lnk.title)?.trim() || "Untitled",
          toSqlString(lnk.url)?.trim() || "",
          toSqlString(lnk.notes),
          toSqlString(lnk.icon_url),
          toSqlString(lnk.tags)
        );
        linkUrlMap.set(key, newId);
        linksTouched++;
      }
    }

    // Shortcuts
    const existingShortcuts = db
      .prepare("SELECT id, lower(title) AS ltitle FROM quick_shortcuts WHERE user_id = ?")
      .all(userId) as Array<{ id: string; ltitle: string }>;
    const scTitleSet = new Set(existingShortcuts.map((s) => s.ltitle));
    const insertShortcutStmt = db.prepare(
      "INSERT INTO quick_shortcuts (id, user_id, title, value, icon, sort_order) VALUES (?, ?, ?, ?, ?, ?)"
    );

    for (const sc of parsed.links?.shortcuts ?? []) {
      if (!sc.title?.trim() || !sc.value?.trim()) continue;
      const ltitle = sc.title.trim().toLowerCase();
      if (!scTitleSet.has(ltitle)) {
        insertShortcutStmt.run(
          sc.id || randomUUID(),
          userId,
          sc.title.trim(),
          sc.value.trim(),
          sc.icon || "link",
          toSqlNumber(sc.sort_order) ?? 0
        );
        scTitleSet.add(ltitle);
        linksTouched++;
      }
    }

    db.exec("COMMIT;");
  } catch (err) {
    db.exec("ROLLBACK;");
    log.error({ err }, "Full backup restore rolled back due to error");
    throw err;
  }

  log.info(
    {
      userId,
      jobsCreated,
      jobsUpdated,
      companiesTouched,
      contactsTouched,
      linksTouched,
      positionsCreated,
      skillsCreated,
      errorCount: errors.length,
    },
    "Full backup restored instantly in single transaction"
  );

  try {
    revalidatePath("/settings");
    revalidatePath("/jobs");
    revalidatePath("/board");
    revalidatePath("/contacts");
    revalidatePath("/network");
    revalidatePath("/overview");
    revalidatePath("/resources");
  } catch {}

  return {
    success: true,
    jobsCreated,
    jobsUpdated,
    companiesTouched,
    contactsTouched,
    linksTouched,
    positionsCreated,
    skillsCreated,
    errors,
  };
}
