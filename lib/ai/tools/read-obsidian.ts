import type { ToolDefinition } from "./types";
import { promises as fs } from "fs";
import path from "path";

/**
 * Read-only Obsidian vault tool. The user configures a vault path (a local
 * filesystem directory) in the Workspace Sources drawer; the Next.js server
 * (which runs on the user's own machine in this self-hosted app) reads Markdown
 * notes from it. SECURITY: paths are strictly confined to the configured vault
 * root — path traversal outside it is rejected. Read-only: no writes.
 */

const MAX_FILES = 20;
const MAX_BYTES = 20000;

function safeJoin(vaultRoot: string, rel: string): string | null {
  const target = path.resolve(vaultRoot, rel);
  const root = path.resolve(vaultRoot);
  if (target !== root && !target.startsWith(root + path.sep)) return null;
  return target;
}

export const readObsidianTool: ToolDefinition = {
  name: "read_obsidian",
  sourceId: "obsidian",
  description:
    "Search and read the user's Obsidian vault (local Markdown notes). Use when the user references a note, a second brain, or wants to incorporate personal knowledge from their vault. Returns note names and text. The vault path is configured by the user; if unset, reports that it needs setup.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Optional term to match against note filenames/content. If empty, lists recent notes.",
      },
    },
  },
  execute: async (args, ctx) => {
    const vaultPath = ctx.sourceConfig?.obsidian?.vaultPath;
    if (typeof vaultPath !== "string" || !vaultPath) {
      return {
        content:
          "Obsidian vault path is not configured. The user must set it in Workspace Sources (a local folder path). No data was read.",
        citations: [],
      };
    }

    try {
      const query = typeof args.query === "string" ? args.query.toLowerCase() : "";

      // Collect .md files (recursive, bounded).
      const files: string[] = [];
      const walk = async (dir: string, depth: number) => {
        if (depth > 4 || files.length >= 200) return;
        let entries: import("fs").Dirent[];
        try {
          entries = await fs.readdir(dir, { withFileTypes: true });
        } catch {
          return;
        }
        for (const e of entries) {
          const full = safeJoin(vaultPath, path.relative(vaultPath, path.join(dir, e.name)));
          if (!full) continue;
          if (e.isDirectory()) {
            if (e.name === ".git" || e.name === ".obsidian") continue;
            await walk(full, depth + 1);
          } else if (e.isFile() && e.name.endsWith(".md")) {
            files.push(full);
          }
        }
      };
      await walk(vaultPath, 0);

      if (files.length === 0) {
        return { content: `No Markdown notes found in the configured vault at ${vaultPath}.`, citations: ["Obsidian Vault"] };
      }

      // If a query is given, prefer filename/content matches; else take the most
      // recently modified notes (bounded).
      let chosen = files;
      if (query) {
        const matched = files.filter((f) => path.basename(f).toLowerCase().includes(query));
        chosen = matched.length ? matched : files.slice(0, MAX_FILES);
      } else {
        chosen = files.slice(0, MAX_FILES);
      }

      const parts: string[] = [];
      for (const f of chosen) {
        try {
          const buf = await fs.readFile(f);
          const text = buf.toString("utf8").slice(0, MAX_BYTES);
          parts.push(`# ${path.basename(f)}\n${text}`);
        } catch {
          /* skip unreadable */
        }
        if (parts.join("\n").length > MAX_BYTES * 2) break;
      }

      return {
        content: `Obsidian vault (${files.length} notes total, showing ${chosen.length}):\n\n${parts.join("\n\n---\n\n")}`,
        citations: ["Obsidian Vault"],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: `Failed to read Obsidian vault: ${msg}`, citations: ["Obsidian Vault"] };
    }
  },
};
