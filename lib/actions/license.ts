"use server";

import { randomUUID, createHash } from "node:crypto";
import { getUser } from "@/lib/auth";
import { getDb } from "@/lib/db/sqlite";
import { decrypt, encrypt } from "@/lib/encryption";
import { moduleLogger } from "@/lib/log";

// Mandatory device activation against the separate "Better Job - Website"
// project (not part of this repo — see its app/api/license/activate/route.ts
// for the server side of this exchange). atTrack itself never asks for
// payment: activation only confirms this is a real device, not a bot.
//
// app/(dashboard)/layout.tsx blocks the entire dashboard shell until
// getLicenseState().activated is true — there is no free-usage grace period
// and no way to dismiss the activation screen.

const log = moduleLogger("actions.license");

interface UsersLicenseRow {
  device_identifier: string | null;
  device_token_encrypted: string | null;
  license_key_encrypted: string | null;
  license_activated_at: string | null;
}

function readLicenseRow(userId: string): UsersLicenseRow {
  const db = getDb();
  try {
    const row = db
      .prepare(
        "SELECT device_identifier, device_token_encrypted, license_key_encrypted, license_activated_at FROM users WHERE id = ?"
      )
      .get(userId) as UsersLicenseRow | undefined;
    return row ?? { device_identifier: null, device_token_encrypted: null, license_key_encrypted: null, license_activated_at: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/no such column: license_key_encrypted/i.test(msg)) {
      try {
        db.exec("ALTER TABLE users ADD COLUMN license_key_encrypted TEXT");
        const row = db
          .prepare(
            "SELECT device_identifier, device_token_encrypted, license_key_encrypted, license_activated_at FROM users WHERE id = ?"
          )
          .get(userId) as UsersLicenseRow | undefined;
        return row ?? { device_identifier: null, device_token_encrypted: null, license_key_encrypted: null, license_activated_at: null };
      } catch {
        const fallbackRow = db
          .prepare(
            "SELECT device_identifier, device_token_encrypted, license_activated_at FROM users WHERE id = ?"
          )
          .get(userId) as Partial<UsersLicenseRow> | undefined;
        return {
          device_identifier: fallbackRow?.device_identifier ?? null,
          device_token_encrypted: fallbackRow?.device_token_encrypted ?? null,
          license_key_encrypted: null,
          license_activated_at: fallbackRow?.license_activated_at ?? null,
        };
      }
    }
    throw err;
  }
}

export interface LicenseState {
  activated: boolean;
  activatedAt: string | null;
  licenseKey: string;
  tier: string;
  deviceIdentifier: string | null;
}

function getDisplayLicenseKey(row: UsersLicenseRow, userId: string): string {
  if (row.license_key_encrypted) {
    try {
      const dec = decrypt(row.license_key_encrypted);
      if (dec) return dec.toUpperCase();
    } catch {
      // fallback
    }
  }
  // Deterministic fallback code formatted as BJOB-XXXXXX-XXXXXX-XXXXXX-XXXXXX
  const seed = (row.device_identifier || userId) + "-betterjob-pro-license";
  const hash = createHash("sha256").update(seed).digest("hex").toUpperCase();
  const p1 = hash.slice(0, 6);
  const p2 = hash.slice(6, 12);
  const p3 = hash.slice(12, 18);
  const p4 = hash.slice(18, 24);
  return `BJOB-${p1}-${p2}-${p3}-${p4}`;
}

/** Read-only activation status. app/(dashboard)/layout.tsx checks this on
 *  every request and renders LicenseActivationScreen instead of the
 *  dashboard shell while activated is false. */
export async function getLicenseState(): Promise<LicenseState> {
  const { userId } = await getUser();
  const row = readLicenseRow(userId);
  const activated = row.license_activated_at !== null;
  const licenseKey = getDisplayLicenseKey(row, userId);
  return {
    activated,
    activatedAt: row.license_activated_at,
    licenseKey,
    tier: "Pro Tier",
    deviceIdentifier: row.device_identifier,
  };
}

import { getDeviceFingerprint } from "@/lib/device-fingerprint";

/** Ensures a stable per-install hardware identifier exists using OS-level
 *  fingerprinting (MachineGuid on Windows, IOPlatformUUID on macOS, etc.).
 *  Re-installing on the same machine guarantees the exact same identifier,
 *  preventing duplicate device rows. */
export async function getDeviceIdentifier(): Promise<string> {
  const { userId } = await getUser().catch(() => ({ userId: "local-user" }));
  const fingerprint = getDeviceFingerprint();
  try {
    getDb().prepare("UPDATE users SET device_identifier = ? WHERE id = ?").run(fingerprint, userId);
  } catch {}
  return fingerprint;
}

function ensureDeviceIdentifier(userId: string): string {
  const fingerprint = getDeviceFingerprint();
  getDb().prepare("UPDATE users SET device_identifier = ? WHERE id = ?").run(fingerprint, userId);
  return fingerprint;
}

export interface ActivateLicenseResult {
  success: boolean;
  error?: string;
}

/**
 * Directly stores the device token and license key received from the
 * browser OAuth/deep-link handshake (betterjob://activate).
 */
export async function activateLicenseWithToken(
  token: string,
  licenseKey: string
): Promise<ActivateLicenseResult> {
  if (!token || !licenseKey) {
    return { success: false, error: "Missing token or license key." };
  }

  const { userId } = await getUser();
  ensureDeviceIdentifier(userId);

  try {
    getDb()
      .prepare(
        "UPDATE users SET device_token_encrypted = ?, license_key_encrypted = ?, license_activated_at = ? WHERE id = ?"
      )
      .run(encrypt(token), encrypt(licenseKey), new Date().toISOString(), userId);
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/no such column: license_key_encrypted/i.test(msg)) {
      try {
        getDb().exec("ALTER TABLE users ADD COLUMN license_key_encrypted TEXT");
        getDb()
          .prepare(
            "UPDATE users SET device_token_encrypted = ?, license_key_encrypted = ?, license_activated_at = ? WHERE id = ?"
          )
          .run(encrypt(token), encrypt(licenseKey), new Date().toISOString(), userId);
        return { success: true };
      } catch {
        getDb()
          .prepare("UPDATE users SET device_token_encrypted = ?, license_activated_at = ? WHERE id = ?")
          .run(encrypt(token), new Date().toISOString(), userId);
        return { success: true };
      }
    }
    log.error({ err }, "Failed to save deep-link activation credentials");
    return { success: false, error: "Failed to store activation credentials." };
  }
}

/**
 * Deactivates and locks local license state when revoked or unlinked remotely.
 */
export async function deactivateLocalLicense(): Promise<void> {
  try {
    const { userId } = await getUser().catch(() => ({ userId: "local-user" }));
    getDb()
      .prepare("UPDATE users SET device_token_encrypted = NULL, license_activated_at = NULL WHERE id = ?")
      .run(userId);
    log.info("Local license deactivated successfully.");
  } catch (err) {
    log.error({ err }, "Failed to deactivate local license");
  }
}

/**
 * Silently validates the license against the website server (every 5 minutes).
 * If the key has been deleted/revoked or the device unlinked, deactivates locally.
 */
export async function verifyLicenseSilent(): Promise<{ valid: boolean; reason?: string }> {
  const token = await getDeviceToken();
  if (!token) {
    return { valid: false, reason: "no_token" };
  }

  const websiteUrl = process.env.NEXT_PUBLIC_ATTRACK_WEBSITE_URL;
  if (!websiteUrl) {
    return { valid: true };
  }

  try {
    const res = await fetch(`${websiteUrl}/api/license/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.status === 401 || res.status === 403) {
      const data = (await res.json().catch(() => ({}))) as { reason?: string };
      log.warn({ data }, "Silent heartbeat failed: license revoked or device unlinked.");
      await deactivateLocalLicense();
      return { valid: false, reason: data.reason || "revoked" };
    }

    return { valid: true };
  } catch {
    // Network/offline — transient error, do not de-activate immediately
    return { valid: true };
  }
}

/**
 * Redeems a license key pasted by the user against the BetterJob website's
 * activation API, and stores the returned device token AES-256-GCM
 * encrypted at rest.
 */
export async function activateLicense(licenseKeyRaw: string): Promise<ActivateLicenseResult> {
  const licenseKey = licenseKeyRaw.trim();
  if (!licenseKey) {
    return { success: false, error: "Enter your license key." };
  }

  const websiteUrl = process.env.NEXT_PUBLIC_ATTRACK_WEBSITE_URL;
  if (!websiteUrl) {
    log.error("NEXT_PUBLIC_ATTRACK_WEBSITE_URL is not configured — cannot activate.");
    return { success: false, error: "Couldn't reach the activation server." };
  }

  const { userId } = await getUser();
  const deviceIdentifier = ensureDeviceIdentifier(userId);

  let response: Response;
  try {
    response = await fetch(`${websiteUrl}/api/license/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        licenseKey,
        deviceIdentifier,
        deviceName: process.env.COMPUTERNAME || process.env.HOSTNAME || null,
        platform: process.platform,
      }),
    });
  } catch (err) {
    log.error({ err }, "License activation request failed");
    return { success: false, error: "Couldn't reach the activation server. Check your connection." };
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    return { success: false, error: body?.error || "That license key isn't valid." };
  }

  const data = (await response.json()) as { deviceToken: string };
  try {
    getDb()
      .prepare("UPDATE users SET device_token_encrypted = ?, license_key_encrypted = ?, license_activated_at = ? WHERE id = ?")
      .run(encrypt(data.deviceToken), encrypt(licenseKey), new Date().toISOString(), userId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/no such column: license_key_encrypted/i.test(msg)) {
      try {
        getDb().exec("ALTER TABLE users ADD COLUMN license_key_encrypted TEXT");
        getDb()
          .prepare("UPDATE users SET device_token_encrypted = ?, license_key_encrypted = ?, license_activated_at = ? WHERE id = ?")
          .run(encrypt(data.deviceToken), encrypt(licenseKey), new Date().toISOString(), userId);
      } catch {
        getDb()
          .prepare("UPDATE users SET device_token_encrypted = ?, license_activated_at = ? WHERE id = ?")
          .run(encrypt(data.deviceToken), new Date().toISOString(), userId);
      }
    } else {
      throw err;
    }
  }

  return { success: true };
}

/**
 * Decrypted device bearer token for calling the website's device-authed
 * APIs.
 */
export async function getDeviceToken(): Promise<string | null> {
  const { userId } = await getUser();
  const row = readLicenseRow(userId);
  if (!row.device_token_encrypted) return null;
  try {
    return decrypt(row.device_token_encrypted);
  } catch (err) {
    log.error({ err }, "Failed to decrypt stored device token");
    return null;
  }
}

