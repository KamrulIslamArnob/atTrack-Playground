import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import fs from "node:fs";
import path from "node:path";
import { moduleLogger } from "@/lib/log";

const log = moduleLogger("encryption");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const KEY_FILE_PATH = path.join(process.cwd(), ".data", "encryption.key");
// Read-only compatibility key for data encrypted by builds that shipped with
// this fallback baked in. Never used to encrypt new data — see the throw
// below — only tried, and logged, as a last resort when decrypting.
const LEGACY_DEV_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

/**
 * Resolves the AES encryption key:
 * 1. Explicit `ENCRYPTION_KEY` or `SMTP_ENCRYPTION_KEY` env var if set.
 * 2. Persistent installation-specific random 32-byte key stored securely in `.data/encryption.key`.
 *
 * Throws rather than falling back to a known key on failure: silently
 * encrypting new secrets with a public key would be worse than crashing loud.
 */
export function getResolvedEncryptionKey(): string {
  const envKey = process.env.ENCRYPTION_KEY || process.env.SMTP_ENCRYPTION_KEY;
  if (envKey && envKey.trim()) {
    return envKey.trim();
  }

  try {
    if (fs.existsSync(KEY_FILE_PATH)) {
      const existing = fs.readFileSync(KEY_FILE_PATH, "utf8").trim();
      if (existing.length >= 32) return existing;
    }
    const dir = path.dirname(KEY_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const generated = randomBytes(32).toString("hex");
    fs.writeFileSync(KEY_FILE_PATH, generated, { encoding: "utf8", mode: 0o600 });
    return generated;
  } catch (err) {
    log.error({ err }, "[encryption] Failed to access local encryption key file:");
    throw new Error("Unable to resolve an encryption key: local key file is inaccessible.");
  }
}

function parseKeyToBuffer(key: string): Buffer {
  if (key.length === 64) {
    return Buffer.from(key, "hex");
  }
  const b64 = Buffer.from(key, "base64");
  if (b64.length === 32) {
    return b64;
  }
  return Buffer.from(key.padEnd(32, "0").slice(0, 32), "utf8");
}

function getKey(): Buffer {
  return parseKeyToBuffer(getResolvedEncryptionKey());
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:ciphertext (all hex)
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

function tryDecryptWithBuffer(encryptedData: string, keyBuffer: Buffer): string | null {
  try {
    const [ivHex, authTagHex, ciphertext] = encryptedData.split(":");
    if (!ivHex || !authTagHex || !ciphertext) return null;

    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = createDecipheriv(ALGORITHM, keyBuffer, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    return null;
  }
}

export function decrypt(encryptedData: string): string {
  const [ivHex, authTagHex, ciphertext] = encryptedData.split(":");
  if (!ivHex || !authTagHex || !ciphertext) {
    throw new Error("Invalid encrypted data format");
  }

  // 1. Try primary resolved key. Resolution itself can throw (key file
  // inaccessible) — that must not block trying the legacy key below.
  try {
    const primaryKey = getKey();
    const primaryResult = tryDecryptWithBuffer(encryptedData, primaryKey);
    if (primaryResult !== null) {
      return primaryResult;
    }
  } catch (err) {
    log.error({ err }, "[encryption] Could not resolve the primary key while decrypting:");
  }

  // 2. Legacy dev key fallback — read-only compatibility for data encrypted
  // before per-install keys existed. Logged because it means live data is
  // still resting on a publicly known key.
  const legacyKey = parseKeyToBuffer(LEGACY_DEV_KEY);
  const legacyResult = tryDecryptWithBuffer(encryptedData, legacyKey);
  if (legacyResult !== null) {
    log.warn("[encryption] Decrypted using the legacy hardcoded key — re-save this credential to migrate it to the per-install key.");
    return legacyResult;
  }

  throw new Error("Failed to decrypt credentials: authentication failed with active keys.");
}
