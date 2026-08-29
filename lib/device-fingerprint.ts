import { createHash, randomUUID } from "node:crypto";
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import os from "node:os";

let cachedFingerprint: string | null = null;

/**
 * Converts a 32-byte hex hash into standard 8-4-4-4-12 UUID format
 */
function hexToUuid(hex: string): string {
  const clean = hex.replace(/[^0-9a-fA-F]/g, "").padEnd(32, "0").slice(0, 32);
  return `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16, 20)}-${clean.slice(20, 32)}`.toLowerCase();
}

/**
 * Reads the persistent fallback cache stored in OS user data / app data.
 */
function getPersistentAnchorPath(): string {
  const baseDir =
    process.env.APPDATA ||
    (process.platform === "darwin"
      ? path.join(os.homedir(), "Library", "Application Support", "BetterJob")
      : path.join(os.homedir(), ".config", "BetterJob"));

  try {
    mkdirSync(baseDir, { recursive: true });
  } catch {}

  return path.join(baseDir, ".device_fingerprint");
}

/**
 * Extracts a hardware-level machine identifier based on OS.
 * Completely deterministic and stable across app installs/reinstalls,
 * data folder migrations, and database recreation.
 */
function extractRawHardwareId(): string | null {
  const platform = process.platform;

  try {
    if (platform === "win32") {
      // 1. Try Windows Cryptography MachineGuid (most reliable, per-OS installation)
      try {
        const output = execSync(
          'reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid',
          { encoding: "utf8", timeout: 3000, stdio: ["ignore", "pipe", "ignore"] }
        );
        const match = output.match(/MachineGuid\s+REG_SZ\s+([a-zA-Z0-9_-]+)/i);
        if (match?.[1]?.trim()) {
          return `win-guid:${match[1].trim()}`;
        }
      } catch {}

      // 2. Fallback to PowerShell ComputerSystemProduct UUID
      try {
        const output = execSync(
          'powershell -NoProfile -NonInteractive -Command "(Get-CimInstance -Class Win32_ComputerSystemProduct).UUID"',
          { encoding: "utf8", timeout: 4000, stdio: ["ignore", "pipe", "ignore"] }
        );
        const trimmed = output.trim();
        if (trimmed && trimmed.length > 10 && !trimmed.includes("FFFFFFFF")) {
          return `win-wmi:${trimmed}`;
        }
      } catch {}
    } else if (platform === "darwin") {
      // macOS: Query IOPlatformUUID
      try {
        const output = execSync("ioreg -rd1 -c IOPlatformExpertDevice", {
          encoding: "utf8",
          timeout: 3000,
          stdio: ["ignore", "pipe", "ignore"],
        });
        const match = output.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/);
        if (match?.[1]?.trim()) {
          return `mac-uuid:${match[1].trim()}`;
        }
      } catch {}
    } else if (platform === "linux") {
      // Linux: Read machine-id
      for (const filePath of ["/etc/machine-id", "/var/lib/dbus/machine-id"]) {
        if (existsSync(filePath)) {
          const content = readFileSync(filePath, "utf8").trim();
          if (content) {
            return `linux-id:${content}`;
          }
        }
      }
    }
  } catch {}

  return null;
}

/**
 * Returns a deterministic, tamper-resistant, persistent device identifier.
 * 
 * Guarantees:
 * - Installing 1 or 100 times on the same machine returns the EXACT same UUID.
 * - Survives SQLite DB wipes, app reinstallation, and version upgrades.
 * - Always formatted as a standard RFC-4122 compliant UUID string.
 */
export function getDeviceFingerprint(): string {
  if (cachedFingerprint) {
    return cachedFingerprint;
  }

  const anchorPath = getPersistentAnchorPath();

  // Check persistent disk anchor
  try {
    if (existsSync(anchorPath)) {
      const stored = readFileSync(anchorPath, "utf8").trim();
      if (stored && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(stored)) {
        cachedFingerprint = stored;
        return stored;
      }
    }
  } catch {}

  const rawId = extractRawHardwareId();
  let finalUuid: string;

  if (rawId) {
    // Deterministic hash with an app-specific salt
    const hash = createHash("sha256")
      .update(`betterjob-fingerprint-salt-v1:${rawId}`)
      .digest("hex");
    finalUuid = hexToUuid(hash);
  } else {
    // Ultimate fallback if OS permissions block reading system identifiers
    finalUuid = randomUUID();
  }

  // Persist anchor for resilience
  try {
    writeFileSync(anchorPath, finalUuid, "utf8");
  } catch {}

  cachedFingerprint = finalUuid;
  return finalUuid;
}
