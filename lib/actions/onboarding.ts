"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { getDb, rebuildOmniSearchIndex } from "@/lib/db/sqlite";
import { seedSampleJobsAndContacts, deleteSampleData, hasDemoData } from "@/lib/db/seed-demo";
import { createProvider } from "./ai-providers";
import type { ProviderType } from "@/lib/types/ai-providers";
import { scheduleResumeExtract } from "@/lib/ai/background";
import { moduleLogger } from "@/lib/log";

const log = moduleLogger("actions.onboarding");

export interface OnboardingPayload {
  fullName?: string;
  email?: string;
  targetRole?: string;
  experienceLevel?: "entry" | "mid" | "senior";
  resumeText?: string;
  resumeFileName?: string;
  aiProvider?: {
    name: string;
    providerType: ProviderType;
    apiKey: string;
    model: string;
    baseUrl?: string;
  };
  seedDemoData?: boolean;
}

export async function completeOnboarding(payload: OnboardingPayload): Promise<{
  success: boolean;
  error?: string;
  seededCount?: number;
}> {
  try {
    const { userId } = await getUser();
    const db = getDb();
    const now = new Date().toISOString();

    // 1. Update Profile (Name & Mark Onboarded)
    const trimmedName = (payload.fullName || "").trim();
    if (trimmedName) {
      db.prepare(
        "UPDATE profiles SET full_name = ?, onboarded_at = ?, updated_at = ? WHERE id = ?"
      ).run(trimmedName, now, now, userId);
    } else {
      db.prepare(
        "UPDATE profiles SET onboarded_at = ?, updated_at = ? WHERE id = ?"
      ).run(now, now, userId);
    }

    // 1b. Update email — lives on `users`, not `profiles` (see lib/db/local-user.ts).
    // Same pattern updateProfile() already uses in lib/actions/auth.ts.
    const trimmedEmail = (payload.email || "").trim();
    if (trimmedEmail) {
      db.prepare("UPDATE users SET email = ? WHERE id = ?").run(trimmedEmail, userId);
    }

    // 2. Create/Update Primary Position (Target Role)
    let positionId: string | null = null;
    const targetRole = (payload.targetRole || "").trim();
    if (targetRole) {
      const level = payload.experienceLevel || "mid";

      // Unset previous primary if any
      db.prepare("UPDATE positions SET is_primary = 0 WHERE user_id = ?").run(userId);

      const existingPos = db
        .prepare("SELECT id FROM positions WHERE user_id = ? AND lower(name) = lower(?)")
        .get(userId, targetRole) as { id: string } | undefined;

      if (existingPos) {
        positionId = existingPos.id;
        db.prepare(
          "UPDATE positions SET experience_level = ?, is_primary = 1, updated_at = ? WHERE id = ?"
        ).run(level, now, positionId);
      } else {
        positionId = randomUUID();
        db.prepare(
          `INSERT INTO positions (id, user_id, name, experience_level, is_primary, created_at, updated_at)
           VALUES (?, ?, ?, ?, 1, ?, ?)`
        ).run(positionId, userId, targetRole, level, now, now);
      }
    }

    // 3. Create Default Resume (if text was provided)
    let documentId: string | null = null;
    const resumeText = (payload.resumeText || "").trim();
    if (resumeText) {
      documentId = randomUUID();
      const docName = (payload.resumeFileName || "Master Resume").replace(/\.[^/.]+$/, "");

      // Unset existing defaults
      db.prepare("UPDATE documents SET is_default = 0 WHERE user_id = ?").run(userId);

      db.prepare(
        `INSERT INTO documents (
          id, user_id, type, name, file_path, content, is_default, created_at, updated_at
        ) VALUES (
          ?, ?, 'resume', ?, '', ?, 1, ?, ?
        )`
      ).run(documentId, userId, docName, resumeText, now, now);

      // Link resume to position if position was created
      if (positionId) {
        db.prepare("UPDATE positions SET resume_id = ? WHERE id = ?").run(documentId, positionId);
      }

      // Schedule background skill extraction if AI is active
      try {
        scheduleResumeExtract(documentId, resumeText, userId, "resume");
      } catch {
        // Non-blocking
      }
    }

    // 4. Create & Verify AI Provider (if provided)
    if (payload.aiProvider && payload.aiProvider.apiKey.trim()) {
      try {
        await createProvider({
          name: payload.aiProvider.name || "Default AI",
          provider_type: payload.aiProvider.providerType,
          model: payload.aiProvider.model,
          api_key: payload.aiProvider.apiKey,
          base_url: payload.aiProvider.baseUrl,
        });
      } catch (err) {
        log.error({ err }, "Failed to auto-configure AI provider during onboarding");
      }
    }

    // 5. Seed Sample Data (if requested)
    let seededCount = 0;
    if (payload.seedDemoData) {
      const seeded = seedSampleJobsAndContacts({ userId, positionId });
      seededCount = seeded.jobIds.length;
    }

    rebuildOmniSearchIndex(db);

    safeRevalidatePaths(["/", "/overview", "/jobs", "/documents", "/settings"]);

    return { success: true, seededCount };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err }, "Error in completeOnboarding");
    return { success: false, error: message };
  }
}

function safeRevalidatePaths(paths: string[]) {
  for (const p of paths) {
    try {
      revalidatePath(p);
    } catch {
      // Ignored outside Next.js request context (e.g. standalone test scripts)
    }
  }
}

/** Skips onboarding and marks user as onboarded immediately */
export async function skipOnboarding(): Promise<{ success: boolean }> {
  const { userId } = await getUser();
  const db = getDb();
  const now = new Date().toISOString();

  db.prepare("UPDATE profiles SET onboarded_at = ?, updated_at = ? WHERE id = ?").run(now, now, userId);

  safeRevalidatePaths(["/", "/overview"]);
  return { success: true };
}

/** Resets onboarding timestamp so user can replay the tour */
export async function resetOnboarding(): Promise<{ success: boolean }> {
  const { userId } = await getUser();
  const db = getDb();

  db.prepare("UPDATE profiles SET onboarded_at = NULL WHERE id = ?").run(userId);

  safeRevalidatePaths(["/", "/overview", "/settings"]);
  return { success: true };
}

/** Returns status about whether demo data is active and user onboarding status */
export async function getOnboardingStatus(): Promise<{
  isOnboarded: boolean;
  hasDemoData: boolean;
  primaryPositionName?: string;
  hasResume: boolean;
  hasAiProvider: boolean;
  hasChatted: boolean;
}> {
  const { userId } = await getUser();
  const db = getDb();

  const profile = db
    .prepare("SELECT onboarded_at FROM profiles WHERE id = ?")
    .get(userId) as { onboarded_at: string | null } | undefined;

  const position = db
    .prepare("SELECT name FROM positions WHERE user_id = ? AND is_primary = 1")
    .get(userId) as { name: string } | undefined;

  const resumeCount = db
    .prepare("SELECT COUNT(*) as count FROM documents WHERE user_id = ? AND type = 'resume'")
    .get(userId) as { count: number } | undefined;

  const aiProviderCount = db
    .prepare("SELECT COUNT(*) as count FROM ai_providers WHERE user_id = ? AND verified_at IS NOT NULL")
    .get(userId) as { count: number } | undefined;

  const chatMsgCount = db
    .prepare("SELECT COUNT(*) as count FROM chat_messages WHERE user_id = ? AND role = 'user'")
    .get(userId) as { count: number } | undefined;

  return {
    isOnboarded: Boolean(profile?.onboarded_at),
    hasDemoData: hasDemoData(userId),
    primaryPositionName: position?.name,
    hasResume: (resumeCount?.count ?? 0) > 0,
    hasAiProvider: (aiProviderCount?.count ?? 0) > 0,
    hasChatted: (chatMsgCount?.count ?? 0) > 0,
  };
}

/** Deletes all sample/demo data from the workspace in one click */
export async function clearSampleDataAction(): Promise<{ success: boolean; removedCount: number }> {
  const { userId } = await getUser();
  const res = deleteSampleData(userId);

  safeRevalidatePaths([
    "/",
    "/overview",
    "/jobs",
    "/board",
    "/applications",
    "/interviews",
    "/network",
    "/resources",
    "/settings",
    "/preferences",
  ]);

  return { success: true, removedCount: res.removedCount };
}

/** Seeds the comprehensive Big Tech & AI showcase demo suite in one click */
export async function seedDemoDataAction(): Promise<{
  success: boolean;
  jobCount: number;
  companyCount: number;
  contactCount: number;
}> {
  const { userId } = await getUser();
  const res = seedSampleJobsAndContacts({ userId });

  safeRevalidatePaths([
    "/",
    "/overview",
    "/jobs",
    "/board",
    "/applications",
    "/interviews",
    "/network",
    "/resources",
    "/settings",
    "/preferences",
  ]);

  return {
    success: true,
    jobCount: res.jobIds.length,
    companyCount: res.companyIds.length,
    contactCount: res.contactIds.length,
  };
}

