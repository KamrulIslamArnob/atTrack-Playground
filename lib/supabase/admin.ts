import { createDbClient, type DbClient } from "@/lib/db/client";

/**
 * Kept only so existing call sites need no edits — it is now identical to
 * createClient().
 *
 * Under Supabase this used the service-role key to bypass RLS. SQLite has no RLS
 * and the app has no sessions, so there is nothing left to be privileged about.
 *
 * Consequence worth knowing: the RLS backstop that made "wrong client" a
 * contained mistake is gone. Any query written here must scope by user_id itself
 * unless it is genuinely meant to read across all rows (activity logging, the
 * admin viewers).
 */
export function createAdminClient(): DbClient {
  return createDbClient();
}
