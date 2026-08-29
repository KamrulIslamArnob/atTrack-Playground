"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { getDb } from "@/lib/db/sqlite";
import { decrypt, encrypt } from "@/lib/encryption";
import { moduleLogger } from "@/lib/log";
import { exportFullBackup, importFullBackup } from "@/lib/actions/full-backup";

// "Sync with Git Gist" (Settings → Information → Data backups). Pushes the
// same payload lib/actions/cloud-sync.ts uploads to Neon, but to a private
// Gist on the user's own GitHub account instead — a backup destination that
// needs no account with us at all. Two ways to authenticate atTrack against
// GitHub, both landing in the same github_sync_config row:
//   - A pasted personal access token (`gist` scope), verified against
//     GET /user before it's stored.
//   - The OAuth Device Authorization flow (RFC 8628) — the same mechanism
//     `gh auth login` uses: no callback URL needed, which matters here
//     since an Electron app has no public HTTPS endpoint of its own.
//     Requires GITHUB_OAUTH_CLIENT_ID to be configured; getGithubSyncStatus()
//     reports whether it is so the UI can hide that option otherwise.

const log = moduleLogger("actions.gist-sync");

const GITHUB_API = "https://api.github.com";
const GIST_FILENAME = "betterjob-backup.json";
const LEGACY_GIST_FILENAME = "attrack-backup.json";
const USER_AGENT = "BetterJob-Desktop-App";

function githubHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": USER_AGENT,
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

interface GithubSyncConfigRow {
  id: string;
  token_encrypted: string | null;
  auth_method: "pat" | "oauth" | null;
  github_username: string | null;
  gist_id: string | null;
  last_synced_at: string | null;
  last_sync_size_bytes: number | null;
}

function readConfigRow(userId: string): GithubSyncConfigRow | null {
  const db = getDb();
  return (
    (db
      .prepare(
        `SELECT id, token_encrypted, auth_method, github_username, gist_id, last_synced_at, last_sync_size_bytes
         FROM github_sync_config WHERE user_id = ?`
      )
      .get(userId) as GithubSyncConfigRow | undefined) ?? null
  );
}

type SqlValue = string | number | null;

function upsertConfig(userId: string, fields: Partial<Omit<GithubSyncConfigRow, "id">>): void {
  const db = getDb();
  const existing = readConfigRow(userId);
  const keys = Object.keys(fields);
  const values = keys.map((k) => (fields as Record<string, SqlValue>)[k]);
  if (existing) {
    if (keys.length === 0) return;
    const setClause = keys.map((k) => `${k} = ?`).join(", ");
    db.prepare(`UPDATE github_sync_config SET ${setClause} WHERE user_id = ?`).run(...values, userId);
  } else {
    const columns = ["id", "user_id", ...keys];
    const placeholders = columns.map(() => "?").join(", ");
    db.prepare(`INSERT INTO github_sync_config (${columns.join(", ")}) VALUES (${placeholders})`).run(
      randomUUID(),
      userId,
      ...values
    );
  }
}

export interface GithubSyncStatus {
  connected: boolean;
  username: string | null;
  authMethod: "pat" | "oauth" | null;
  gistUrl: string | null;
  lastSyncedAt: string | null;
  lastSyncSizeBytes: number | null;
  oauthConfigured: boolean;
}

export async function getGithubSyncStatus(): Promise<GithubSyncStatus> {
  const { userId } = await getUser();
  const row = readConfigRow(userId);
  return {
    connected: Boolean(row?.token_encrypted),
    username: row?.github_username ?? null,
    authMethod: row?.auth_method ?? null,
    gistUrl: row?.gist_id && row?.github_username ? `https://gist.github.com/${row.github_username}/${row.gist_id}` : null,
    lastSyncedAt: row?.last_synced_at ?? null,
    lastSyncSizeBytes: row?.last_sync_size_bytes ?? null,
    oauthConfigured: Boolean(process.env.GITHUB_OAUTH_CLIENT_ID),
  };
}

async function fetchGithubUsername(token: string): Promise<{ username: string; scopes: string[] }> {
  const res = await fetch(`${GITHUB_API}/user`, { headers: githubHeaders(token) });
  if (!res.ok) {
    throw new Error(res.status === 401 ? "That token isn't valid." : "Couldn't verify that token with GitHub.");
  }
  const scopesHeader = res.headers.get("x-oauth-scopes") ?? "";
  const scopes = scopesHeader.split(",").map((s) => s.trim()).filter(Boolean);
  const data = (await res.json()) as { login: string };
  return { username: data.login, scopes };
}

export interface ConnectGithubResult {
  success: boolean;
  username?: string;
  error?: string;
}

/** Stores a pasted personal access token after verifying it works and, when
 *  GitHub reports token scopes at all (classic PATs only — fine-grained
 *  tokens don't), that it actually carries `gist`. */
export async function connectGithubWithToken(tokenRaw: string): Promise<ConnectGithubResult> {
  const token = tokenRaw.trim();
  if (!token) return { success: false, error: "Paste a personal access token first." };

  let username: string;
  try {
    const result = await fetchGithubUsername(token);
    if (result.scopes.length > 0 && !result.scopes.includes("gist")) {
      return { success: false, error: "That token doesn't have the \"gist\" scope. Create one that includes it." };
    }
    username = result.username;
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Couldn't verify that token." };
  }

  const { userId } = await getUser();
  upsertConfig(userId, {
    token_encrypted: encrypt(token),
    auth_method: "pat",
    github_username: username,
  });

  try {
    revalidatePath("/settings");
  } catch {}
  return { success: true, username };
}

export async function disconnectGithub(): Promise<{ success: boolean }> {
  const { userId } = await getUser();
  upsertConfig(userId, {
    token_encrypted: null,
    auth_method: null,
    github_username: null,
    gist_id: null,
    last_synced_at: null,
    last_sync_size_bytes: null,
  });
  try {
    revalidatePath("/settings");
  } catch {}
  return { success: true };
}

// ---------------------------------------------------------------------------
// OAuth Device Authorization flow (RFC 8628) — no callback URL needed.
// ---------------------------------------------------------------------------

export interface DeviceFlowStart {
  success: boolean;
  error?: string;
  deviceCode?: string;
  userCode?: string;
  verificationUri?: string;
  expiresIn?: number;
  interval?: number;
}

export async function startGithubDeviceFlow(): Promise<DeviceFlowStart> {
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  if (!clientId) {
    return { success: false, error: "GitHub sign-in isn't configured for this build. Use a personal access token instead." };
  }

  let res: Response;
  try {
    res = await fetch("https://github.com/login/device/code", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json", "User-Agent": USER_AGENT },
      body: new URLSearchParams({ client_id: clientId, scope: "gist" }),
    });
  } catch (err) {
    log.error({ err }, "GitHub device code request failed");
    return { success: false, error: "Couldn't reach GitHub. Check your connection." };
  }

  if (!res.ok) {
    return { success: false, error: "GitHub rejected the device authorization request." };
  }

  const data = (await res.json()) as {
    device_code: string;
    user_code: string;
    verification_uri: string;
    expires_in: number;
    interval: number;
  };

  return {
    success: true,
    deviceCode: data.device_code,
    userCode: data.user_code,
    verificationUri: data.verification_uri,
    expiresIn: data.expires_in,
    interval: data.interval,
  };
}

export interface DeviceFlowPollResult {
  status: "pending" | "slow_down" | "success" | "expired" | "denied" | "error";
  username?: string;
  error?: string;
}

/** One poll attempt. The client re-calls this on the `interval` GitHub gave
 *  startGithubDeviceFlow() until it gets back something other than
 *  "pending"/"slow_down". */
export async function pollGithubDeviceFlow(deviceCode: string): Promise<DeviceFlowPollResult> {
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  if (!clientId) return { status: "error", error: "GitHub sign-in isn't configured for this build." };

  let res: Response;
  try {
    res = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json", "User-Agent": USER_AGENT },
      body: new URLSearchParams({
        client_id: clientId,
        device_code: deviceCode,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      }),
    });
  } catch (err) {
    log.error({ err }, "GitHub device flow poll failed");
    return { status: "error", error: "Couldn't reach GitHub. Check your connection." };
  }

  const data = (await res.json().catch(() => ({}))) as { access_token?: string; error?: string };

  if (data.error === "authorization_pending") return { status: "pending" };
  if (data.error === "slow_down") return { status: "slow_down" };
  if (data.error === "expired_token") return { status: "expired", error: "That code expired. Start again." };
  if (data.error === "access_denied") return { status: "denied", error: "Sign-in was cancelled." };
  if (data.error) return { status: "error", error: "GitHub couldn't complete sign-in." };
  if (!data.access_token) return { status: "error", error: "GitHub didn't return an access token." };

  let username: string;
  try {
    username = (await fetchGithubUsername(data.access_token)).username;
  } catch {
    username = "GitHub";
  }

  const { userId } = await getUser();
  upsertConfig(userId, {
    token_encrypted: encrypt(data.access_token),
    auth_method: "oauth",
    github_username: username,
  });

  try {
    revalidatePath("/settings");
  } catch {}
  return { status: "success", username };
}

// ---------------------------------------------------------------------------
// Sync (push) / Pull (restore)
// ---------------------------------------------------------------------------

function requireToken(row: GithubSyncConfigRow | null): string {
  if (!row?.token_encrypted) throw new Error("Connect GitHub first.");
  return decrypt(row.token_encrypted);
}

export interface GistSyncResult {
  success: boolean;
  error?: string;
  gistUrl?: string;
  sizeBytes?: number;
}

/** Pushes the full local backup to the user's Gist, creating it on first
 *  sync and PATCHing the same Gist on every sync after that. */
export async function syncToGist(): Promise<GistSyncResult> {
  const { userId } = await getUser();
  const row = readConfigRow(userId);

  let token: string;
  try {
    token = requireToken(row);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Connect GitHub first." };
  }

  const { json, sizeBytes } = await exportFullBackup();

  const body = JSON.stringify({
    description: "BetterJob local backup — managed by the app, safe to leave private",
    public: false,
    files: {
      [GIST_FILENAME]: { content: json },
      ...(row?.gist_id ? { [LEGACY_GIST_FILENAME]: null } : {}),
    },
  });

  try {
    const isUpdate = Boolean(row?.gist_id);
    const url = isUpdate ? `${GITHUB_API}/gists/${row!.gist_id}` : `${GITHUB_API}/gists`;
    const res = await fetch(url, {
      method: isUpdate ? "PATCH" : "POST",
      headers: { ...githubHeaders(token), "Content-Type": "application/json" },
      body,
    });

    if (!res.ok) {
      if (res.status === 404 && isUpdate) {
        // The Gist was deleted on GitHub's side — clear the stale id and
        // let the user retry, which will create a fresh one.
        upsertConfig(userId, { gist_id: null });
        return { success: false, error: "That Gist no longer exists on GitHub. Try syncing again to create a new one." };
      }
      return { success: false, error: `GitHub rejected the sync (${res.status}).` };
    }

    const data = (await res.json()) as { id: string; html_url: string };
    const now = new Date().toISOString();
    upsertConfig(userId, { gist_id: data.id, last_synced_at: now, last_sync_size_bytes: sizeBytes });
    try {
      revalidatePath("/settings");
    } catch {}
    return { success: true, gistUrl: data.html_url, sizeBytes };
  } catch (err) {
    log.error({ err }, "Gist sync failed");
    return { success: false, error: "Couldn't reach GitHub. Check your connection." };
  }
}

export interface GistPullResult {
  success: boolean;
  error?: string;
  jobsCreated?: number;
  jobsUpdated?: number;
  companiesTouched?: number;
  contactsTouched?: number;
  linksTouched?: number;
}

/** Downloads the Gist and restores it into the local database. Never wipes
 *  local data first — see importFullBackup(). */
export async function pullFromGist(): Promise<GistPullResult> {
  const { userId } = await getUser();
  const row = readConfigRow(userId);

  let token: string;
  try {
    token = requireToken(row);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Connect GitHub first." };
  }
  if (!row?.gist_id) {
    return { success: false, error: "No Gist to pull from yet — sync at least once first." };
  }

  let content: string;
  try {
    const res = await fetch(`${GITHUB_API}/gists/${row.gist_id}`, { headers: githubHeaders(token) });
    if (!res.ok) {
      return { success: false, error: res.status === 404 ? "That Gist no longer exists on GitHub." : "Couldn't reach that Gist." };
    }
    const data = (await res.json()) as {
      files: Record<string, { content?: string; truncated?: boolean; raw_url?: string; filename?: string }>;
    };
    const files = data.files || {};
    const file =
      files[GIST_FILENAME] ||
      files[LEGACY_GIST_FILENAME] ||
      Object.values(files).find((f) => f?.filename?.endsWith(".json")) ||
      Object.values(files)[0];

    if (!file) return { success: false, error: "That Gist doesn't contain a BetterJob backup file." };

    if (file.truncated && file.raw_url) {
      const rawRes = await fetch(file.raw_url, { headers: { "User-Agent": USER_AGENT } });
      content = await rawRes.text();
    } else {
      content = file.content ?? "";
    }
  } catch (err) {
    log.error({ err }, "Gist pull failed");
    return { success: false, error: "Couldn't reach GitHub. Check your connection." };
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
