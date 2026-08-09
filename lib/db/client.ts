import { getDb } from "./sqlite.ts";
import { from } from "./query.ts";
import { createAuthApi } from "./auth-api.ts";
import { createStorageApi } from "./storage.ts";

// Assembles the object that stands in for a supabase-js client:
//   .from(table)  -> the SQLite query builder
//   .rpc(name)    -> the JS ports of the Postgres functions
//   .auth         -> resolves the single local owner (no login; see local-user.ts)
//   .storage      -> filesystem-backed buckets

/** Ports of the Postgres functions that migrations defined. */
const RPCS: Record<string, (args: Record<string, unknown>) => unknown> = {
  /** Mirrors public.seed_board_lists() from migration 019 — same names, kinds, colours, order. */
  seed_board_lists(args) {
    const userId = args.p_user_id as string;
    if (!userId) throw new Error("seed_board_lists requires p_user_id");

    const defaults: [string, string, string, number][] = [
      ["Wishlist", "wishlist", "#94A3B8", 1],
      ["Preparing", "preparing", "#F59E0B", 2],
      ["Applied", "applied", "#8B5CF6", 3],
      ["Interview", "interview", "#10B981", 4],
      ["Offer", "offer", "#059669", 5],
      ["Rejected", "rejected", "#EF4444", 6],
    ];

    const db = getDb();
    // OR IGNORE leans on idx_board_lists_one_per_kind, so re-seeding is a no-op
    // exactly like the ON CONFLICT DO NOTHING in the SQL version.
    const stmt = db.prepare(
      `INSERT OR IGNORE INTO board_lists (id, user_id, name, kind, color, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    for (const [name, kind, color, order] of defaults) {
      stmt.run(crypto.randomUUID(), userId, name, kind, color, order);
    }
    return null;
  },
};

export function createDbClient() {
  return {
    from,

    async rpc(name: string, args: Record<string, unknown> = {}) {
      const fn = RPCS[name];
      if (!fn) {
        return {
          data: null,
          error: { message: `Unknown RPC "${name}". Add it to lib/db/client.ts.` },
        };
      }
      try {
        return { data: fn(args), error: null };
      } catch (err) {
        return { data: null, error: { message: (err as Error).message } };
      }
    },

    auth: createAuthApi(),
    storage: createStorageApi(),
  };
}

export type DbClient = ReturnType<typeof createDbClient>;
