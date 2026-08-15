import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { getDb } from "./sqlite.ts";

// Per-install shared secret the companion browser extension (extension/) sends
// as `Authorization: Bearer <secret>` on every call to /api/extension/*.
//
// atTrack has no login (see lib/db/local-user.ts), so getUser() can't tell a
// legitimate extension request apart from any other process that can reach
// the local server. This secret is the actual gate for those two routes.
//
// Created lazily on first read, same "create on first run" shape as the
// owner row in local-user.ts.

function getOrCreateExtensionSecret(userId: string): string {
  const db = getDb();

  const existing = db
    .prepare("SELECT secret FROM extension_config WHERE user_id = ?")
    .get(userId) as { secret: string } | undefined;

  if (existing) return existing.secret;

  const secret = randomBytes(32).toString("hex");
  db.prepare(
    "INSERT INTO extension_config (id, user_id, secret) VALUES (?, ?, ?)"
  ).run(randomUUID(), userId, secret);

  return secret;
}

export { getOrCreateExtensionSecret };

/**
 * Validates an `Authorization: Bearer <secret>` header against the stored
 * extension secret. Same timing-safe comparison shape as
 * lib/db/storage.ts's verifyObjectToken.
 */
export function verifyExtensionAuth(authHeader: string | null, userId: string): boolean {
  if (!authHeader?.startsWith("Bearer ")) return false;
  const provided = authHeader.slice("Bearer ".length).trim();
  if (!provided) return false;

  const expected = getOrCreateExtensionSecret(userId);
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
