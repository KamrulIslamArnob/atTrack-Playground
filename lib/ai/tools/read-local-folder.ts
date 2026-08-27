import type { ToolDefinition } from "./types";
import { promises as fs } from "fs";
import path from "path";

/**
 * Read-only tool for inspecting files and documents in the active local workspace folder.
 * Security: Path traversal outside the configured root is prevented.
 */

const MAX_FILES = 25;
const MAX_BYTES = 25000;

const IGNORED = new Set([
  ".git",
  ".obsidian",
  "node_modules",
  ".next",
  "dist",
  "build",
  ".cache",
  ".vscode",
  ".trash",
  ".data",
]);

function safeResolve(root: string, rel: string): string | null {
  const target = path.resolve(root, rel);
  const resolvedRoot = path.resolve(root);
  if (target !== resolvedRoot && !target.startsWith(resolvedRoot + path.sep)) {
    return null;
  }
  return target;
}

export const readLocalFolderTool: ToolDefinition = {
  name: "read_local_folder",
  sourceId: "obsidian",
  description:
    "Explore, search, and read files and documents from the user's selected local folder workspace. Use when the user asks about local project files, documentation, notes, or code in their connected folder.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Optional filename or keyword to search for within the folder.",
      },
      filePath: {
        type: "string",
        description: "Optional relative path to a specific file to read completely.",
      },
    },
  },
  execute: async (args, ctx) => {
    // Check active local folder or configured vault path
    const folderConfig = ctx.sourceConfig?.localFolder || ctx.sourceConfig?.obsidian;
    const folderPath =
      (typeof folderConfig?.path === "string" ? folderConfig.path : null) ||
      (typeof folderConfig?.vaultPath === "string" ? folderConfig.vaultPath : null);

    if (!folderPath) {
      return {
        content:
          "No local folder workspace is currently selected or configured. Please select a local folder from the composer header (`📁 <Folder Name>`).",
        citations: [],
      };
    }

    try {
      const folderName = path.basename(folderPath) || "Local Workspace";

      // If specific file requested
      if (typeof args.filePath === "string" && args.filePath.trim()) {
        const full = safeResolve(folderPath, args.filePath.trim());
        if (!full) {
          return { content: `Access denied: Invalid path '${args.filePath}'.`, citations: [folderName] };
        }
        try {
          const buf = await fs.readFile(full);
          const text = buf.toString("utf8").slice(0, MAX_BYTES);
          return {
            content: `### File: ${args.filePath}\n\`\`\`\n${text}\n\`\`\``,
            citations: [folderName, args.filePath],
          };
        } catch (e) {
          const fileErr = e instanceof Error ? e.message : String(e);
          return { content: `Failed to read file '${args.filePath}': ${fileErr}`, citations: [folderName] };
        }
      }

      // Collect files in folder (bounded walk)
      const query = typeof args.query === "string" ? args.query.toLowerCase().trim() : "";
      const foundFiles: string[] = [];

      const walk = async (dir: string, depth: number) => {
        if (depth > 4 || foundFiles.length >= 150) return;
        let entries: import("fs").Dirent[];
        try {
          entries = await fs.readdir(dir, { withFileTypes: true });
        } catch {
          return;
        }

        for (const e of entries) {
          if (e.name.startsWith(".")) continue;
          if (e.isDirectory()) {
            if (IGNORED.has(e.name.toLowerCase())) continue;
            const full = safeResolve(folderPath, path.relative(folderPath, path.join(dir, e.name)));
            if (full) await walk(full, depth + 1);
          } else if (e.isFile()) {
            const full = safeResolve(folderPath, path.relative(folderPath, path.join(dir, e.name)));
            if (full) foundFiles.push(full);
          }
        }
      };

      await walk(folderPath, 0);

      if (foundFiles.length === 0) {
        return {
          content: `No accessible files found in local folder workspace '${folderName}' (${folderPath}).`,
          citations: [folderName],
        };
      }

      let chosen = foundFiles;
      if (query) {
        const matched = foundFiles.filter((f) => path.basename(f).toLowerCase().includes(query));
        chosen = matched.length > 0 ? matched : foundFiles.slice(0, MAX_FILES);
      } else {
        chosen = foundFiles.slice(0, MAX_FILES);
      }

      const summaries: string[] = [];
      for (const f of chosen.slice(0, 10)) {
        const rel = path.relative(folderPath, f);
        try {
          const ext = path.extname(f).toLowerCase();
          const isText = [".md", ".txt", ".json", ".ts", ".tsx", ".js", ".jsx", ".html", ".css", ".py"].includes(ext);
          if (isText) {
            const buf = await fs.readFile(f);
            const snippet = buf.toString("utf8").slice(0, 800).replace(/\r\n/g, "\n");
            summaries.push(`- **${rel}**:\n\`\`\`\n${snippet}${buf.length > 800 ? "\n..." : ""}\n\`\`\``);
          } else {
            summaries.push(`- **${rel}** (binary/unindexed file)`);
          }
        } catch {}
      }

      return {
        content: `Local Workspace '${folderName}' (${foundFiles.length} files found, showing ${chosen.length}):\n\n${summaries.join("\n\n")}`,
        citations: [folderName],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: `Error accessing local folder workspace: ${msg}`, citations: ["Local Workspace"] };
    }
  },
};
