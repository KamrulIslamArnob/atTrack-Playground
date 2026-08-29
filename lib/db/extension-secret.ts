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
//
// SECURITY NOTE (accepted tradeoff, not an oversight): unlike the sibling
// "Better Job - Website" project's device tokens (lib/security/tokens.ts
// there), which are hashed at rest because they live in a hosted, internet-
// facing Postgres database, this secret is stored in PLAINTEXT in local
// SQLite and is redisplayed/copyable any time from Settings → Extension —
// components/settings/extension-settings.tsx relies on being able to fetch
// and show it again for re-pairing, not just show it once at creation.
// That's the right tradeoff for a secret whose entire threat model is
// "never leaves this machine": the moment something CAN read this local
// database file, it can already read every job/contact/resume in it, so a
// plaintext extension secret adds no meaningfully new exposure — and
// hashing it would break the redisplay flow for no real gain. Revisit only
// if this secret (or the raw SQLite file) is ever synced off-device outside
// the existing, explicitly opt-in and separately-gated cloud backup path
// (lib/actions/cloud-sync.ts), which never includes it.

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
