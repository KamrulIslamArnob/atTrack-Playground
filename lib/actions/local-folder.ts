"use server";

import { promises as fs } from "fs";
import path from "path";

export interface LocalVaultValidationResult {
  valid: boolean;
  normalizedPath: string;
  vaultName: string;
  noteCount: number;
  fileCount?: number;
  sampleNotes: string[];
  error?: string;
}

const IGNORED_DIRS = new Set([
  ".git",
  "node_modules",
  ".next",
  "dist",
  "build",
  ".cache",
  ".vscode",
  ".trash",
  ".data",
]);

function isSubPath(parent: string, child: string): boolean {
  const rel = path.relative(parent, child);
  return !rel.startsWith("..") && !path.isAbsolute(rel);
}

/**
 * Validates a local directory on the machine, counting markdown/code documents
 * and returning samples.
 */
export async function validateLocalVault(inputPath: string): Promise<LocalVaultValidationResult> {
  const trimmed = (inputPath || "").trim();
  if (!trimmed) {
    return {
      valid: false,
      normalizedPath: "",
      vaultName: "",
      noteCount: 0,
      sampleNotes: [],
      error: "Path cannot be empty.",
    };
  }

  const resolved = path.resolve(trimmed);

  try {
    const stat = await fs.stat(resolved);
    if (!stat.isDirectory()) {
      return {
        valid: false,
        normalizedPath: resolved,
        vaultName: path.basename(resolved),
        noteCount: 0,
        sampleNotes: [],
        error: "Path is not a directory.",
      };
    }

    const sampleNotes: string[] = [];
    let noteCount = 0;
    let fileCount = 0;

    const walk = async (currentDir: string, depth: number) => {
      if (depth > 4 || fileCount >= 500) return;
      let entries: import("fs").Dirent[];
      try {
        entries = await fs.readdir(currentDir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        if (entry.name.startsWith(".")) continue;

        if (entry.isDirectory()) {
          if (IGNORED_DIRS.has(entry.name.toLowerCase())) continue;
          await walk(path.join(currentDir, entry.name), depth + 1);
        } else if (entry.isFile()) {
          fileCount++;
          const ext = path.extname(entry.name).toLowerCase();
          const isDoc = [".md", ".txt", ".json", ".ts", ".tsx", ".js", ".jsx", ".py", ".pdf"].includes(ext);
          if (isDoc) {
            noteCount++;
            if (sampleNotes.length < 8) {
              const rel = path.relative(resolved, path.join(currentDir, entry.name));
              sampleNotes.push(rel.replace(/\\/g, "/"));
            }
          }
        }
      }
    };

    await walk(resolved, 0);

    return {
      valid: true,
      normalizedPath: resolved.replace(/\\/g, "/"),
      vaultName: path.basename(resolved) || "Local Workspace",
      noteCount,
      fileCount,
      sampleNotes,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      valid: false,
      normalizedPath: resolved,
      vaultName: path.basename(resolved),
      noteCount: 0,
      sampleNotes: [],
      error: `Could not access directory: ${errorMsg}`,
    };
  }
}

/**
 * List files within a validated local folder workspace.
 */
export async function listLocalFolderFiles(
  folderPath: string,
  subDir = "",
  limit = 100
): Promise<{ files: Array<{ name: string; relativePath: string; isDirectory: boolean; size: number }> }> {
  const root = path.resolve(folderPath);
  const targetDir = subDir ? path.resolve(root, subDir) : root;

  if (!isSubPath(root, targetDir) && root !== targetDir) {
    throw new Error("Access denied: Invalid sub-directory path");
  }

  const entries = await fs.readdir(targetDir, { withFileTypes: true });
  const results = [];

  for (const e of entries) {
    if (e.name.startsWith(".") || IGNORED_DIRS.has(e.name.toLowerCase())) continue;
    const fullPath = path.join(targetDir, e.name);
    const rel = path.relative(root, fullPath).replace(/\\/g, "/");

    let size = 0;
    if (e.isFile()) {
      try {
        const s = await fs.stat(fullPath);
        size = s.size;
      } catch {}
    }

    results.push({
      name: e.name,
      relativePath: rel,
      isDirectory: e.isDirectory(),
      size,
    });

    if (results.length >= limit) break;
  }

  return { files: results };
}

/**
 * Safely read text content of a file within a validated local folder workspace.
 */
export async function readLocalFolderFile(
  folderPath: string,
  relativeFilePath: string
): Promise<{ content: string; path: string }> {
  const root = path.resolve(folderPath);
  const targetFile = path.resolve(root, relativeFilePath);

  if (!isSubPath(root, targetFile)) {
    throw new Error("Access denied: Target file outside of workspace root");
  }

  const stat = await fs.stat(targetFile);
  if (!stat.isFile()) {
    throw new Error("Target is not a file");
  }

  if (stat.size > 2 * 1024 * 1024) {
    throw new Error("File too large (max 2MB supported for inline reading)");
  }

  const buffer = await fs.readFile(targetFile);
  return {
    content: buffer.toString("utf8"),
    path: relativeFilePath.replace(/\\/g, "/"),
  };
}
