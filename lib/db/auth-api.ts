import { getDb } from "./sqlite.ts";
import { getOrCreateLocalUser } from "./local-user.ts";

// Stands in for the slice of `supabase.auth` this app still uses, so call sites
// keep the same `{ data: { user }, error }` shape.
//
// AtTrack is a native single-user app: there is no sign-in, no session, and no
// password. getUser() always resolves the local owner (creating it on first run).
// Everything else that used to live here — signUp, signInWithPassword, signOut,
// OAuth, magic links, password changes — is gone along with the login screens.

export interface AuthUser {
  id: string;
  email: string;
  // Loose index signature, not Record<string, unknown>: call sites read
  // `user_metadata?.full_name` directly, and `unknown` would surface as `{}`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user_metadata: { full_name?: string; avatar_url?: string; [key: string]: any };
  /** Always null — nothing signs in, so there is no sign-in to record. */
  last_sign_in_at?: string | null;
}

export interface AuthError {
  message: string;
  status?: number;
}

export function createAuthApi() {
  return {
    async getUser(): Promise<{ data: { user: AuthUser }; error: null }> {
      const owner = getOrCreateLocalUser();
      return {
        data: {
          user: {
            id: owner.id,
            email: owner.email,
            user_metadata: owner.raw_user_meta_data ?? {},
          },
        },
        error: null,
      };
    },

    /**
     * Admin-side helpers. With a single owner these are near-trivial, but the
     * admin activity and AI-usage viewers still join against them.
     */
    admin: {
      async listUsers(): Promise<{ data: { users: AuthUser[] }; error: null }> {
        const rows = getDb()
          .prepare("SELECT id, email, raw_user_meta_data FROM users ORDER BY created_at DESC")
          .all() as unknown as UserRow[];

        return { data: { users: rows.map(rowToAuthUser) }, error: null };
      },

      async getUserById(
        userId: string
      ): Promise<{ data: { user: AuthUser | null }; error: AuthError | null }> {
        const row = getDb()
          .prepare("SELECT id, email, raw_user_meta_data FROM users WHERE id = ?")
          .get(userId) as unknown as UserRow | undefined;

        if (!row) return { data: { user: null }, error: { message: "User not found", status: 404 } };
        return { data: { user: rowToAuthUser(row) }, error: null };
      },

      async deleteUser(userId: string): Promise<{ error: AuthError | null }> {
        // profiles and every owned row cascade from users via ON DELETE CASCADE.
        getDb().prepare("DELETE FROM users WHERE id = ?").run(userId);
        return { error: null };
      },
    },
  };
}

interface UserRow {
  id: string;
  email: string;
  raw_user_meta_data: string | null;
}

function rowToAuthUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    user_metadata: row.raw_user_meta_data ? safeParse(row.raw_user_meta_data) : {},
    last_sign_in_at: null,
  };
}

function safeParse(value: string): Record<string, unknown> {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export type AuthApi = ReturnType<typeof createAuthApi>;
