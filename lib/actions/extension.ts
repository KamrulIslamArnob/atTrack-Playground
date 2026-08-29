"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { getOrCreateExtensionSecret } from "@/lib/db/extension-secret";
import { getDb } from "@/lib/db/sqlite";
import { moduleLogger } from "@/lib/log";

const log = moduleLogger("extension-actions");

/** The per-install secret the browser extension pastes into its popup. */
export async function getExtensionSecret(): Promise<string> {
  const { userId } = await getUser();
  return getOrCreateExtensionSecret(userId);
}

/** Regenerates and updates the bearer token in extension_config for the current user. */
export async function rotateExtensionSecret(): Promise<{ success: boolean; secret?: string }> {
  try {
    const { userId } = await getUser();
    const db = getDb();
    const newSecret = randomBytes(32).toString("hex");

    const existing = db
      .prepare("SELECT id FROM extension_config WHERE user_id = ?")
      .get(userId) as { id: string } | undefined;

    if (existing) {
      db.prepare("UPDATE extension_config SET secret = ? WHERE user_id = ?").run(newSecret, userId);
    } else {
      db.prepare("INSERT INTO extension_config (id, user_id, secret) VALUES (?, ?, ?)").run(
        randomUUID(),
        userId,
        newSecret
      );
    }

    try {
      revalidatePath("/settings");
    } catch {}
    return { success: true, secret: newSecret };
  } catch (error) {
    log.error({ error }, "Failed to rotate extension secret");
    return { success: false };
  }
}

