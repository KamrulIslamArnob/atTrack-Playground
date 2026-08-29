"use server";

import { gunzipSync, gzipSync } from "node:zlib";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { getDb } from "@/lib/db/sqlite";
import { moduleLogger } from "@/lib/log";
import { getDeviceToken, getLicenseState, deactivateLocalLicense } from "@/lib/actions/license";
import { exportFullBackup, importFullBackup } from "@/lib/actions/full-backup";
import { createStorageApi } from "@/lib/db/storage";

// "Cloud backup and sync" (Settings → Information → Data backups), backed
// by the already-built Neon + object-storage API on the separate "Better
// Job - Website" project (app/api/backups/*). Reuses the same device
// bearer token license activation already established — there is no
// separate "log in for cloud sync" step: activation *is* the login, and
// whether any data ever leaves this device stays fully opt-in (Sync Now /
// AutoSync, both off until the user turns them on).

const log = moduleLogger("actions.cloud-sync");

// 500KB per user, per the product spec — enforced authoritatively on the
// website too (its app/api/backups/route.ts). Checked here first so an
// over-limit backup fails fast with a clear message instead of burning a
// presigned upload it can't use.
const CLOUD_STORAGE_LIMIT_BYTES = 500 * 1024;

// Separate, more generous cap for the profile photo — mirrors the
// website's AVATAR_STORAGE_LIMIT_BYTES (lib/storage/presign.ts there).
// A photo is naturally bigger than the text backup's budget above, so it
// gets its own.
const AVATAR_STORAGE_LIMIT_BYTES = 3 * 1024 * 1024;

const AVATAR_CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  avif: "image/avif",
  bmp: "image/bmp",
  tiff: "image/tiff",
  tif: "image/tiff",
  ico: "image/x-icon",
  heic: "image/heic",
  heif: "image/heif",
};

/** Reverse of AVATAR_CONTENT_TYPES, for turning a downloaded object's
 *  Content-Type back into the file extension pullAvatarFromCloud() writes
 *  locally. Falls back to "png" for anything unrecognized. */
function extensionForContentType(contentType: string): string {
  const normalized = contentType.split(";")[0]?.trim().toLowerCase();
  const found = Object.entries(AVATAR_CONTENT_TYPES).find(([, ct]) => ct === normalized);
  return found?.[0] ?? "png";
}

interface CloudSyncConfigRow {
  id: string;
  autosync_enabled: number;
  last_synced_at: string | null;
  last_sync_size_bytes: number | null;
  sync_avatar_enabled: number;
  last_avatar_synced_at: string | null;
}

function readConfigRow(userId: string): CloudSyncConfigRow | null {
  const db = getDb();
  return (
    (db
      .prepare(
        "SELECT id, autosync_enabled, last_synced_at, last_sync_size_bytes, sync_avatar_enabled, last_avatar_synced_at FROM cloud_sync_config WHERE user_id = ?"
      )
      .get(userId) as CloudSyncConfigRow | undefined) ?? null
  );
}

type SqlValue = string | number | null;

function upsertConfig(userId: string, fields: Partial<Omit<CloudSyncConfigRow, "id">>): void {
  const db = getDb();
  const existing = readConfigRow(userId);
  const keys = Object.keys(fields);
  const values = keys.map((k) => (fields as Record<string, SqlValue>)[k]);
  if (existing) {
    if (keys.length === 0) return;
    const setClause = keys.map((k) => `${k} = ?`).join(", ");
    db.prepare(`UPDATE cloud_sync_config SET ${setClause} WHERE user_id = ?`).run(...values, userId);
  } else {
    const columns = ["id", "user_id", ...keys];
    const placeholders = columns.map(() => "?").join(", ");
    db.prepare(`INSERT INTO cloud_sync_config (${columns.join(", ")}) VALUES (${placeholders})`).run(
      randomUUID(),
      userId,
      ...values
    );
  }
}

function websiteUrl(): string | null {
  return process.env.NEXT_PUBLIC_ATTRACK_WEBSITE_URL || null;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  return `${(n / 1024).toFixed(1)} KB`;
}

async function extractError(res: Response, fallback: string): Promise<string> {
  if (res.status === 401 || res.status === 403) {
    void deactivateLocalLicense();
  }
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return body?.error || fallback;
}


export interface CloudSyncStatus {
  /** This device has redeemed a license key at all — required for any
   *  cloud call, since the device bearer token IS the cloud credential. */
  licensed: boolean;
  autosyncEnabled: boolean;
  lastSyncedAt: string | null;
  lastSyncSizeBytes: number | null;
  limitBytes: number;
  /** Separate opt-in from autosyncEnabled — a profile photo is more
   *  personal than job/company text data, so it gets its own explicit
   *  consent rather than riding along with the data AutoSync toggle. */
  avatarSyncEnabled: boolean;
  lastAvatarSyncedAt: string | null;
  avatarLimitBytes: number;
}

export async function getCloudSyncStatus(): Promise<CloudSyncStatus> {
  const { userId } = await getUser();
  const license = await getLicenseState();
  const row = readConfigRow(userId);
  return {
    licensed: license.activated,
    autosyncEnabled: Boolean(row?.autosync_enabled),
    lastSyncedAt: row?.last_synced_at ?? null,
    lastSyncSizeBytes: row?.last_sync_size_bytes ?? null,
    limitBytes: CLOUD_STORAGE_LIMIT_BYTES,
    avatarSyncEnabled: Boolean(row?.sync_avatar_enabled),
    lastAvatarSyncedAt: row?.last_avatar_synced_at ?? null,
    avatarLimitBytes: AVATAR_STORAGE_LIMIT_BYTES,
  };
}

export async function setAutoSyncEnabled(enabled: boolean): Promise<{ success: boolean; error?: string }> {
  const license = await getLicenseState();
  if (!license.activated) return { success: false, error: "Activate your license first." };
  const { userId } = await getUser();
  upsertConfig(userId, { autosync_enabled: enabled ? 1 : 0 });
  try {
    revalidatePath("/settings");
  } catch {}
  return { success: true };
}

/**
 * Toggles cloud sync for the profile photo specifically. Turning it OFF
 * also deletes any copy already in the cloud (best-effort) — "off" means
 * "my photo stays local only", not just "stop pushing new versions".
 * Turning it ON does not immediately push — the next saveAvatar() call (or
 * a manual syncAvatarToCloud()) does that; this only records consent.
 */
export async function setAvatarSyncEnabled(enabled: boolean): Promise<{ success: boolean; error?: string }> {
  const license = await getLicenseState();
  if (!license.activated) return { success: false, error: "Activate your license first." };
  const { userId } = await getUser();
  upsertConfig(userId, { sync_avatar_enabled: enabled ? 1 : 0 });

  if (!enabled) {
    void deleteAvatarFromCloud().catch((err) => {
      log.warn({ err }, "Avatar cloud sync: cleanup after turning sync off failed (non-fatal)");
    });
  }

  try {
    revalidatePath("/settings");
  } catch {}
  return { success: true };
}

export interface CloudSyncResult {
  success: boolean;
  error?: string;
  sizeBytes?: number;
}

/** Pushes a fresh full backup to cloud storage: presigned PUT, then a
 *  record call so the website knows it landed. See lib/actions/full-backup.ts
 *  for exactly what's included. */
export async function syncNow(): Promise<CloudSyncResult> {
  const token = await getDeviceToken();
  if (!token) return { success: false, error: "Activate your license first." };

  const base = websiteUrl();
  if (!base) return { success: false, error: "Cloud sync server isn't configured." };

  const { json, payload } = await exportFullBackup();
  const recordCount =
    payload.jobs.count +
    payload.crm.companiesCount +
    payload.crm.contactsCount +
    payload.links.linksCount +
    payload.positions.length +
    payload.skills.length;
  const gzipped = gzipSync(Buffer.from(json, "utf8"));

  if (gzipped.byteLength > CLOUD_STORAGE_LIMIT_BYTES) {
    return {
      success: false,
      error: `Your data is ${formatBytes(gzipped.byteLength)}, over the ${formatBytes(
        CLOUD_STORAGE_LIMIT_BYTES
      )} cloud storage limit. Git Gist sync has no size limit, or free up space by removing old jobs.`,
    };
  }

  let uploadUrlRes: Response;
  try {
    uploadUrlRes = await fetch(`${base}/api/backups/upload-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ recordCount }),
    });
  } catch (err) {
    log.error({ err }, "Cloud sync: upload-url request failed");
    return { success: false, error: "Couldn't reach the cloud sync server. Check your connection." };
  }
  if (!uploadUrlRes.ok) {
    const error = await extractError(uploadUrlRes, "Couldn't start cloud sync.");
    log.warn({ status: uploadUrlRes.status, error }, "Cloud sync: upload-url request rejected");
    return { success: false, error };
  }
  const { uploadUrl, objectKey } = (await uploadUrlRes.json()) as { uploadUrl: string; objectKey: string };

  try {
    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/gzip" },
      body: gzipped,
    });
    if (!putRes.ok) {
      const bodyText = await putRes.text().catch(() => "");
      log.warn({ status: putRes.status, bodyText }, "Cloud sync: object storage rejected the upload");
      return { success: false, error: "Couldn't upload backup data to cloud storage." };
    }
  } catch (err) {
    log.error({ err }, "Cloud sync: upload failed");
    return { success: false, error: "Couldn't reach cloud storage." };
  }

  let recordRes: Response;
  try {
    recordRes = await fetch(`${base}/api/backups`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ objectKey, recordCount }),
    });
  } catch (err) {
    log.error({ err }, "Cloud sync: record request failed");
    return { success: false, error: "Upload succeeded but couldn't confirm it. Try syncing again." };
  }
  if (!recordRes.ok) {
    const error = await extractError(recordRes, "Upload succeeded but couldn't confirm it.");
    log.warn({ status: recordRes.status, error }, "Cloud sync: record request rejected");
    return { success: false, error };
  }

  const { userId } = await getUser();
  const now = new Date().toISOString();
  upsertConfig(userId, { last_synced_at: now, last_sync_size_bytes: gzipped.byteLength });
  try {
    revalidatePath("/settings");
  } catch {}
  return { success: true, sizeBytes: gzipped.byteLength };
}

export interface CloudPullResult {
  success: boolean;
  error?: string;
  jobsCreated?: number;
  jobsUpdated?: number;
  companiesTouched?: number;
  contactsTouched?: number;
  linksTouched?: number;
}

/** Downloads the newest cloud backup and restores it locally. Never wipes
 *  local data first — see importFullBackup(). */
export async function pullFromCloud(): Promise<CloudPullResult> {
  const token = await getDeviceToken();
  if (!token) return { success: false, error: "Activate your license first." };
  const base = websiteUrl();
  if (!base) return { success: false, error: "Cloud sync server isn't configured." };

  let res: Response;
  try {
    res = await fetch(`${base}/api/backups/latest`, { headers: { Authorization: `Bearer ${token}` } });
  } catch (err) {
    log.error({ err }, "Cloud pull: request failed");
    return { success: false, error: "Couldn't reach the cloud sync server. Check your connection." };
  }
  if (res.status === 404) {
    return { success: false, error: "No cloud backup found yet — use Sync Now first." };
  }
  if (!res.ok) {
    return { success: false, error: await extractError(res, "Couldn't reach the cloud sync server.") };
  }

  const { downloadUrl } = (await res.json()) as { downloadUrl: string };

  let content: string;
  try {
    const fileRes = await fetch(downloadUrl);
    if (!fileRes.ok) return { success: false, error: "Couldn't download the backup file." };
    const buf = Buffer.from(await fileRes.arrayBuffer());
    content = gunzipSync(buf).toString("utf8");
  } catch (err) {
    log.error({ err }, "Cloud pull: download/decompress failed");
    return { success: false, error: "Couldn't read that backup file." };
  }

  try {
    const result = await importFullBackup(content);
    return {
      success: true,
      jobsCreated: result.jobsCreated,
      jobsUpdated: result.jobsUpdated,
      companiesTouched: result.companiesTouched,
      contactsTouched: result.contactsTouched,
      linksTouched: result.linksTouched,
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Couldn't restore that backup." };
  }
}

export interface AvatarSyncResult {
  success: boolean;
  error?: string;
  sizeBytes?: number;
}

/** Extracts the local storage key ("{userId}/avatar.{ext}") from a stored
 *  avatar_url of the shape "/api/files/avatar/{userId}/avatar.ext?v=...". */
function localAvatarKeyFromUrl(avatarUrl: string): string | null {
  const match = avatarUrl.match(/\/api\/files\/avatar\/([^?]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Pushes the current local avatar to cloud storage: presigned PUT (same
 * three-step shape as syncNow above), then a record call. Reads the file
 * straight off local disk via lib/db/storage.ts rather than looping back
 * through this server's own HTTP API. No-ops with a clear error if there
 * is no local avatar yet, or if avatar sync isn't licensed.
 */
export async function syncAvatarToCloud(): Promise<AvatarSyncResult> {
  const token = await getDeviceToken();
  if (!token) return { success: false, error: "Activate your license first." };

  const base = websiteUrl();
  if (!base) return { success: false, error: "Cloud sync server isn't configured." };

  const { userId } = await getUser();
  const db = getDb();
  const row = db.prepare("SELECT avatar_url FROM profiles WHERE id = ?").get(userId) as
    | { avatar_url: string | null }
    | undefined;
  if (!row?.avatar_url) return { success: false, error: "No profile photo to sync yet." };

  const localKey = localAvatarKeyFromUrl(row.avatar_url);
  if (!localKey) return { success: false, error: "Couldn't determine the local avatar file." };
  const ext = (localKey.split(".").pop() || "png").toLowerCase();
  const contentType = AVATAR_CONTENT_TYPES[ext] ?? "application/octet-stream";

  let buffer: Buffer;
  try {
    const avatarStorage = createStorageApi().from("avatar");
    const { data, error } = await avatarStorage.download(localKey);
    if (error || !data) throw new Error(error?.message ?? "local file missing");
    buffer = Buffer.from(await data.arrayBuffer());
  } catch (err) {
    log.error({ err, userId, localKey }, "Avatar cloud sync: couldn't read local file");
    return { success: false, error: "Couldn't read the local avatar file." };
  }

  if (buffer.byteLength > AVATAR_STORAGE_LIMIT_BYTES) {
    return {
      success: false,
      error: `Your photo is ${formatBytes(buffer.byteLength)}, over the ${formatBytes(
        AVATAR_STORAGE_LIMIT_BYTES
      )} cloud storage limit.`,
    };
  }

  let uploadUrlRes: Response;
  try {
    uploadUrlRes = await fetch(`${base}/api/avatars/upload-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ext }),
    });
  } catch (err) {
    log.error({ err }, "Avatar cloud sync: upload-url request failed");
    return { success: false, error: "Couldn't reach the cloud sync server. Check your connection." };
  }
  if (!uploadUrlRes.ok) {
    const error = await extractError(uploadUrlRes, "Couldn't start avatar sync.");
    log.warn({ status: uploadUrlRes.status, error }, "Avatar cloud sync: upload-url request rejected");
    return { success: false, error };
  }
  const { uploadUrl, objectKey } = (await uploadUrlRes.json()) as { uploadUrl: string; objectKey: string };

  try {
    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      // Buffer's newer generic ArrayBufferLike typing isn't directly
      // assignable to fetch's BodyInit (unlike gzipSync's return above,
      // whose narrower inferred type is) — an explicit Uint8Array view
      // sidesteps that without copying the underlying bytes.
      body: new Uint8Array(buffer),
    });
    if (!putRes.ok) {
      const bodyText = await putRes.text().catch(() => "");
      log.warn({ status: putRes.status, bodyText }, "Avatar cloud sync: object storage rejected the upload");
      return { success: false, error: "Couldn't upload your photo to cloud storage." };
    }
  } catch (err) {
    log.error({ err }, "Avatar cloud sync: upload failed");
    return { success: false, error: "Couldn't reach cloud storage." };
  }

  let recordRes: Response;
  try {
    recordRes = await fetch(`${base}/api/avatars`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ objectKey, contentType }),
    });
  } catch (err) {
    log.error({ err }, "Avatar cloud sync: record request failed");
    return { success: false, error: "Upload succeeded but couldn't confirm it. Try syncing again." };
  }
  if (!recordRes.ok) {
    const error = await extractError(recordRes, "Upload succeeded but couldn't confirm it.");
    log.warn({ status: recordRes.status, error }, "Avatar cloud sync: record request rejected");
    return { success: false, error };
  }

  upsertConfig(userId, { last_avatar_synced_at: new Date().toISOString() });
  try {
    revalidatePath("/settings");
  } catch {}
  return { success: true, sizeBytes: buffer.byteLength };
}

export interface AvatarPullResult {
  success: boolean;
  error?: string;
  avatarUrl?: string;
}

/**
 * Downloads the latest cloud avatar and writes it into local storage,
 * through the exact same write-then-commit-then-cleanup ordering as
 * saveAvatar() in lib/actions/auth.ts (see that file for why the ordering
 * matters) — this is a second writer of the same local file, so it must
 * not reintroduce the delete-before-write bug fixed there. Used when
 * activating a new device so the photo follows the account, not just the
 * job data pullFromCloud() already restores.
 */
export async function pullAvatarFromCloud(): Promise<AvatarPullResult> {
  const token = await getDeviceToken();
  if (!token) return { success: false, error: "Activate your license first." };
  const base = websiteUrl();
  if (!base) return { success: false, error: "Cloud sync server isn't configured." };

  let res: Response;
  try {
    res = await fetch(`${base}/api/avatars/latest`, { headers: { Authorization: `Bearer ${token}` } });
  } catch (err) {
    log.error({ err }, "Avatar cloud pull: request failed");
    return { success: false, error: "Couldn't reach the cloud sync server. Check your connection." };
  }
  if (res.status === 404) {
    return { success: false, error: "No cloud photo found yet." };
  }
  if (!res.ok) {
    return { success: false, error: await extractError(res, "Couldn't reach the cloud sync server.") };
  }

  const { downloadUrl, contentType } = (await res.json()) as { downloadUrl: string; contentType: string };

  let buffer: Buffer;
  try {
    const fileRes = await fetch(downloadUrl);
    if (!fileRes.ok) return { success: false, error: "Couldn't download the photo." };
    buffer = Buffer.from(await fileRes.arrayBuffer());
  } catch (err) {
    log.error({ err }, "Avatar cloud pull: download failed");
    return { success: false, error: "Couldn't read that photo." };
  }

  const { userId } = await getUser();
  const ext = extensionForContentType(contentType);
  const filePath = `${userId}/avatar.${ext}`;
  const avatarStorage = createStorageApi().from("avatar");

  const { error: uploadError } = await avatarStorage.upload(filePath, buffer, { contentType, upsert: true });
  if (uploadError) {
    log.error({ err: uploadError, userId, filePath }, "Avatar cloud pull: local write failed");
    return { success: false, error: "Couldn't save the downloaded photo locally." };
  }

  const { data: urlData } = avatarStorage.getPublicUrl(filePath);
  const versionedAvatarUrl = `${urlData.publicUrl}?v=${Date.now()}`;

  const db = getDb();
  db.prepare("UPDATE profiles SET avatar_url = ? WHERE id = ?").run(versionedAvatarUrl, userId);

  // Only now — new file written and DB committed — remove any other
  // avatar.* files, same ordering as saveAvatar().
  try {
    const { data: existingFiles } = await avatarStorage.list(userId);
    if (existingFiles && existingFiles.length > 0) {
      const toDelete = existingFiles.map((f) => `${userId}/${f.name}`).filter((p) => p !== filePath);
      if (toDelete.length > 0) await avatarStorage.remove(toDelete);
    }
  } catch (err) {
    log.warn({ err, userId, filePath }, "Avatar cloud pull: stale-file cleanup failed (non-fatal)");
  }

  try {
    revalidatePath("/", "layout");
    revalidatePath("/settings");
  } catch {}

  return { success: true, avatarUrl: versionedAvatarUrl };
}

/** Deletes every cloud copy of this account's avatar — best-effort, never
 *  throws. Called when the local photo is deleted while sync is on, or
 *  when sync is turned off (see setAvatarSyncEnabled above and
 *  deleteAvatar() in lib/actions/auth.ts). */
export async function deleteAvatarFromCloud(): Promise<{ success: boolean; error?: string }> {
  const token = await getDeviceToken();
  if (!token) return { success: true }; // nothing to delete without a device credential
  const base = websiteUrl();
  if (!base) return { success: true };

  try {
    const res = await fetch(`${base}/api/avatars`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const error = await extractError(res, "Couldn't remove the cloud photo.");
      log.warn({ status: res.status, error }, "Avatar cloud delete: request rejected");
      return { success: false, error };
    }
    return { success: true };
  } catch (err) {
    log.error({ err }, "Avatar cloud delete: request failed");
    return { success: false, error: "Couldn't reach the cloud sync server." };
  }
}

/**
 * Fire-and-forget trigger, same contract as maybeAutoSync below: called
 * right after a local avatar save succeeds. No-ops unless licensed and
 * sync_avatar_enabled, and never throws.
 */
export async function maybeAutoSyncAvatar(): Promise<void> {
  try {
    const { userId } = await getUser();
    const license = await getLicenseState();
    if (!license.activated) return;
    const row = readConfigRow(userId);
    if (!row?.sync_avatar_enabled) return;

    const result = await syncAvatarToCloud();
    if (!result.success) {
      log.warn({ error: result.error }, "Avatar AutoSync failed");
    }
  } catch (err) {
    log.error({ err }, "Avatar AutoSync threw unexpectedly");
  }
}

/**
 * Fire-and-forget counterpart called right after a local avatar delete
 * succeeds (lib/actions/auth.ts's deleteAvatar()). Only reaches out to the
 * cloud sync server if avatar sync is actually turned on — deleting a
 * photo that was always local-only shouldn't require a license check or a
 * network call. Never throws.
 */
export async function maybeCloudDeleteAvatar(): Promise<void> {
  try {
    const { userId } = await getUser();
    const license = await getLicenseState();
    if (!license.activated) return;
    const row = readConfigRow(userId);
    if (!row?.sync_avatar_enabled) return;

    const result = await deleteAvatarFromCloud();
    if (!result.success) {
      log.warn({ error: result.error }, "Avatar cloud delete (on local delete) failed");
    }
  } catch (err) {
    log.error({ err }, "Avatar cloud delete (on local delete) threw unexpectedly");
  }
}

/**
 * Fire-and-forget trigger for AutoSync: called (via `void`, never awaited)
 * right after a job or contact is created — see lib/actions/jobs.ts and
 * lib/actions/contacts.ts. Scoped to creation only, matching the product
 * spec's examples; edits/deletes don't currently trigger it. No-ops
 * silently unless this device is both licensed and has AutoSync turned on,
 * and never throws — a failed background sync must never surface as an
 * error on the job/contact action that triggered it.
 */
export async function maybeAutoSync(): Promise<void> {
  try {
    const { userId } = await getUser();
    const license = await getLicenseState();
    if (!license.activated) return;
    const row = readConfigRow(userId);
    if (!row?.autosync_enabled) return;

    const result = await syncNow();
    if (!result.success) {
      log.warn({ error: result.error }, "AutoSync failed");
    }
  } catch (err) {
    log.error({ err }, "AutoSync threw unexpectedly");
  }
}
