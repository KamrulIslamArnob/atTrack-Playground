import { createDbClient, type DbClient } from "@/lib/db/client";

/**
 * The data client.
 *
 * Still named createClient() and still returns a supabase-js-shaped object, so
 * every existing call site works unchanged — but it is now backed by local SQLite
 * (lib/db/*) instead of a hosted Postgres.
 *
 * No longer needs request cookies: AtTrack is a native single-user app with no
 * sessions. `.auth.getUser()` resolves the local owner directly.
 *
 * NOTE: SQLite has no row-level security. Under Supabase, RLS was a second line of
 * defence behind the `.eq("user_id", userId)` filters in lib/actions. Those filters
 * are now the ONLY thing scoping data to a user — never omit one.
 */
export async function createClient(): Promise<DbClient> {
  return createDbClient();
}
