import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

// Filesystem replacement for Supabase Storage, shaped like `supabase.storage`.
//
// Bucket layout mirrors the Postgres setup: three buckets, every object key
// prefixed with the owner's user id ("{userId}/..."). That prefix WAS enforced by
// storage RLS policies. Nothing enforces it at this layer — read authorization
// lives in app/api/files/[bucket]/[...key]/route.ts (signed token or a session
// whose user id matches the key's first segment). This module only validates that
// a key cannot escape its bucket directory (safeKey below).
//
//   documents    private  -> served through /api/files with a signed token
//   job-imports  private  -> same
//   avatar       public   -> served from /api/files without a token

export function getStorageDir(): string {
  if (process.env.STORAGE_DIR) {
    return process.env.STORAGE_DIR;
  }
  if (process.env.SQLITE_DIR) {
    return path.join(process.env.SQLITE_DIR, "storage");
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("node:fs");
  const localDb = path.join(/*turbopackIgnore: true*/ process.cwd(), ".data", "attrack.db");
  if (fs.existsSync(localDb)) {
    return path.join(/*turbopackIgnore: true*/ process.cwd(), ".data", "storage");
  }
  // If running inside Electron on Windows, fallback to configured dataDir in userData config or registry
  if (process.platform === "win32") {
    if (process.env.APPDATA) {
      for (const appName of ["BetterJob", "betterjob", "AtTrack", "atTrack"]) {
        const electronConfig = path.join(process.env.APPDATA, appName, "config.json");
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const fs = require("node:fs");
          if (fs.existsSync(electronConfig)) {
            const parsed = JSON.parse(fs.readFileSync(electronConfig, "utf8"));
            if (parsed.dataDir) {
              return path.join(parsed.dataDir, "storage");
            }
          }
        } catch {
          // ignore
        }
      }
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { execSync } = require("node:child_process");
      const reg = execSync('reg query "HKCU\\Software\\BetterJob" /v DataDir 2>nul', {
        encoding: "utf8",
        windowsHide: true,
        timeout: 1500,
      });
      const match = reg.match(/DataDir\s+REG_SZ\s+(.+)/i);
      if (match && match[1]?.trim()) {
        return path.join(match[1].trim(), "storage");
      }
    } catch {
      // ignore
    }
  }
  const baseDataDir = path.join(/*turbopackIgnore: true*/ process.cwd(), ".data");
  return path.join(baseDataDir, "storage");
}

import { getResolvedEncryptionKey } from "../encryption.ts";

const PUBLIC_BUCKETS = new Set(["avatar"]);

export interface StorageError {
  message: string;
}

function signingKey(): string {
  return getResolvedEncryptionKey();
}

/**
 * Object keys come from callers and end up in a filesystem path, so they are
 * validated rather than trusted: no absolute paths, no "..", no backslashes.
 */
function safeKey(key: string): string {
  let normalized = key.replace(/\\/g, "/");
  normalized = normalized.replace(/^\/+/, "");
  if (
    !normalized ||
    normalized.includes("..") ||
    /^[A-Za-z]:/.test(normalized)
  ) {
    throw new Error(`Unsafe storage key: ${key}`);
  }
  return normalized;
}

function objectPath(bucket: string, key: string): string {
  return path.join(/*turbopackIgnore: true*/ getStorageDir(), safeKey(bucket), safeKey(key));
}

export function signObjectToken(bucket: string, key: string, expiresAt: number): string {
  return createHmac("sha256", signingKey())
    .update(`${bucket}:${key}:${expiresAt}`)
    .digest("hex");
}

export function verifyObjectToken(
  bucket: string,
  key: string,
  expiresAt: number,
  token: string
): boolean {
  if (!Number.isFinite(expiresAt) || expiresAt * 1000 <= Date.now()) return false;
  const expected = signObjectToken(bucket, key, expiresAt);
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(token, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function isPublicBucket(bucket: string): boolean {
  return PUBLIC_BUCKETS.has(bucket);
}

export async function readObject(
  bucket: string,
  key: string
): Promise<{ buffer: Buffer; resolvedKey: string }> {
  const cleanKey = safeKey(key);
  const primaryPath = objectPath(bucket, cleanKey);
  try {
    const buffer = await readFile(primaryPath);
    return { buffer, resolvedKey: cleanKey };
  } catch (err) {
    // Robust universal fallback: If exact filename with extension wasn't found
    // (e.g. requested .webp but stored as .png/.jpeg/.gif/.avif or vice-versa),
    // search the parent directory for matching base filename.
    try {
      const dir = path.dirname(primaryPath);
      const targetBase = path.parse(cleanKey).name.toLowerCase();
      const entries = await readdir(dir, { withFileTypes: true });
      const match = entries.find((e) => {
        if (!e.isFile()) return false;
        const entryBase = path.parse(e.name).name.toLowerCase();
        return entryBase === targetBase;
      });
      if (match) {
        const fallbackPath = path.join(dir, match.name);
        const buffer = await readFile(fallbackPath);
        const segments = cleanKey.split("/");
        segments[segments.length - 1] = match.name;
        return { buffer, resolvedKey: segments.join("/") };
      }
    } catch {
      // pass through original error
    }
    throw err;
  }
}

async function toBuffer(body: unknown): Promise<Buffer> {
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof ArrayBuffer) return Buffer.from(body);
  if (typeof body === "string") return Buffer.from(body);
  // File / Blob
  if (body && typeof (body as Blob).arrayBuffer === "function") {
    return Buffer.from(await (body as Blob).arrayBuffer());
  }
  throw new Error("Unsupported upload body type");
}

function bucketApi(bucket: string) {
  return {
    async upload(
      key: string,
      body: unknown,
      // Accepted for call-site compatibility but not needed: writeFile always
      // overwrites, so { upsert: true } is the only behaviour, and content type is
      // derived from the extension when the file is served.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _options?: { upsert?: boolean; contentType?: string }
    ): Promise<{ data: { path: string }; error: StorageError | null }> {
      try {
        const target = objectPath(bucket, key);
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, await toBuffer(body));
        return { data: { path: safeKey(key) }, error: null };
      } catch (err) {
        return { data: null as never, error: { message: (err as Error).message } };
      }
    },

    async remove(keys: string[]): Promise<{ data: null; error: StorageError | null }> {
      try {
        await Promise.all(
          keys.map(async (key) => {
            try {
              await unlink(objectPath(bucket, key));
            } catch (err) {
              // Deleting an object that is already gone is the desired end state.
              if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
            }
          })
        );
        return { data: null, error: null };
      } catch (err) {
        return { data: null as never, error: { message: (err as Error).message } };
      }
    },

    async download(key: string): Promise<{ data: Blob; error: StorageError | null }> {
      try {
        const { buffer: buf } = await readObject(bucket, key);
        // Callers do `await data.arrayBuffer()`, which Blob provides.
        return { data: new Blob([new Uint8Array(buf)]), error: null };
      } catch (err) {
        return { data: null as never, error: { message: (err as Error).message } };
      }
    },

    async createSignedUrl(
      key: string,
      expiresIn: number
    ): Promise<{ data: { signedUrl: string }; error: StorageError | null }> {
      try {
        const safe = safeKey(key);
        const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;
        const token = signObjectToken(bucket, safe, expiresAt);
        const url =
          `/api/files/${encodeURIComponent(bucket)}/${safe
            .split("/")
            .map(encodeURIComponent)
            .join("/")}?exp=${expiresAt}&token=${token}`;
        return { data: { signedUrl: url }, error: null };
      } catch (err) {
        return { data: null as never, error: { message: (err as Error).message } };
      }
    },

    /** Lists objects directly under `prefix`, shaped like Supabase's { name }[]. */
    async list(
      prefix = ""
    ): Promise<{ data: { name: string }[]; error: StorageError | null }> {
      try {
        const dir = prefix
          ? objectPath(bucket, prefix)
          : path.join(/*turbopackIgnore: true*/ getStorageDir(), safeKey(bucket));
        const entries = await readdir(dir, { withFileTypes: true });
        return {
          data: entries.filter((e) => e.isFile()).map((e) => ({ name: e.name })),
          error: null,
        };
      } catch (err) {
        // A prefix that was never written to is an empty listing, not a failure.
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return { data: [], error: null };
        return { data: null as never, error: { message: (err as Error).message } };
      }
    },

    /**
     * Best-effort orphan cleanup: unlinks files under `prefix` older than
     * `maxAgeMs`. Deletion calls elsewhere (dialog close, cancel, unmount)
     * are fire-and-forget and skipped entirely on a crash/force-close, so
     * this is the backstop — called opportunistically on next upload rather
     * than on a schedule (single-user local app, no cron infra to add).
     */
    async sweepStale(prefix: string, maxAgeMs: number): Promise<void> {
      const dir = objectPath(bucket, prefix);
      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
        throw err;
      }
      const now = Date.now();
      await Promise.all(
        entries
          .filter((e) => e.isFile())
          .map(async (e) => {
            const target = path.join(dir, e.name);
            try {
              const info = await stat(target);
              if (now - info.mtimeMs > maxAgeMs) await unlink(target);
            } catch (err) {
              if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
            }
          })
      );
    },

    getPublicUrl(key: string): { data: { publicUrl: string } } {
      const safe = safeKey(key);
      return {
        data: {
          publicUrl: `/api/files/${encodeURIComponent(bucket)}/${safe
            .split("/")
            .map(encodeURIComponent)
            .join("/")}`,
        },
      };
    },
  };
}

export function createStorageApi() {
  return { from: bucketApi };
}

export const storageDir = getStorageDir();

