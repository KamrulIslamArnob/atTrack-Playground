import { randomUUID } from "node:crypto";
import { getDb } from "./sqlite.ts";

// atTrack runs as a native, single-user local app: there are no accounts, no
// login, and no sessions. Whoever can reach the process IS the owner.
//
// This module resolves that one owner, creating the row on first run so the rest
// of the app (which is written against a `user_id`) keeps working unchanged.

const OWNER_EMAIL = process.env.OWNER_EMAIL || "owner@attrack.local";
const OWNER_NAME = process.env.OWNER_NAME || "atTrack User";

export interface LocalUser {
  id: string;
  email: string;
  raw_user_meta_data: Record<string, unknown> | null;
}

/**
 * Returns the local owner, creating it on first run.
 *
 * The oldest user row wins, so a database created by the previous
 * email/password build keeps its existing data and id instead of stranding it
 * behind a second, empty owner.
 */
export function getOrCreateLocalUser(): LocalUser {
  const db = getDb();

  const existing = db
    .prepare(
      "SELECT id, email, raw_user_meta_data FROM users ORDER BY created_at ASC LIMIT 1"
    )
    .get() as
    | { id: string; email: string; raw_user_meta_data: string | null }
    | undefined;

  if (existing) {
    let email = existing.email;
    if (!email || email === "owner@attrack.local" || email.endsWith("@attrack.local")) {
      email = OWNER_EMAIL;
      db.prepare("UPDATE users SET email = ? WHERE id = ?").run(email, existing.id);
    }
    return {
      id: existing.id,
      email,
      raw_user_meta_data: parseMeta(existing.raw_user_meta_data),
    };
  }

  const id = randomUUID();
  const meta = { full_name: OWNER_NAME };

  // `encrypted_password` is vestigial — it is NOT NULL in databases created by
  // the earlier auth build, so a placeholder keeps this insert working against
  // both old and new files. Nothing ever reads it.
  db.prepare(
    `INSERT INTO users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
     VALUES (?, ?, 'local', ?, ?)`
  ).run(id, OWNER_EMAIL, new Date().toISOString(), JSON.stringify(meta));

  // role stays 'user': the sidebar swaps to an admin-only nav for 'admin',
  // which would hide Board/Jobs/Documents from the only person using the app.
  // The admin routes stay reachable regardless — getAdminUser() permits the owner.
  db.prepare("INSERT OR IGNORE INTO profiles (id, full_name) VALUES (?, ?)").run(id, OWNER_NAME);

  return { id, email: OWNER_EMAIL, raw_user_meta_data: meta };
}

function parseMeta(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}
