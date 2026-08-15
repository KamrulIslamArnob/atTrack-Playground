import type { ToolDefinition } from "./types";

/**
 * Read-only GitHub tool. Uses a Personal Access Token the user provides in the
 * Workspace Sources drawer (stored obfuscated in localStorage, sent to the local
 * server, used here, never logged). Calls only GET endpoints under the `repo`
 * (read) scope. SECURITY: token is redacted from all logs; only read APIs are
 * used. If the token is missing, reports setup-needed instead of failing loud.
 */

const GITHUB_API = "https://api.github.com";

export const searchGithubTool: ToolDefinition = {
  name: "search_github",
  sourceId: "github",
  description:
    "Search the user's GitHub: list repositories, read repo metadata, or list files in a repo. Use when the user references their code, a repository, or wants to incorporate repo context. Read-only; requires the user to have connected a GitHub token in Workspace Sources.",
  parameters: {
    type: "object",
    properties: {
      mode: {
        type: "string",
        enum: ["list_repos", "repo_info", "list_files"],
        description:
          "list_repos = list the user's repositories; repo_info = details for a repo (needs repo); list_files = list top-level files (needs repo).",
      },
      repo: {
        type: "string",
        description: "owner/name for repo_info / list_files, e.g. 'torvalds/linux'.",
      },
      query: {
        type: "string",
        description: "Optional filter substring for list_repos (matches name/description).",
      },
    },
    required: ["mode"],
  },
  execute: async (args, ctx) => {
    const token = ctx.sourceConfig?.github?.token;
    if (typeof token !== "string" || !token) {
      return {
        content:
          "GitHub token is not configured. The user must add a Personal Access Token (read-only `repo` scope) in Workspace Sources. No GitHub data was fetched.",
        citations: [],
      };
    }

    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "atTrack-Chatbot",
    };

    const mode = typeof args.mode === "string" ? args.mode : "list_repos";
    const query = typeof args.query === "string" ? args.query.toLowerCase() : "";

    try {
      if (mode === "list_repos") {
        const res = await fetch(`${GITHUB_API}/user/repos?per_page=50&sort=updated`, { headers });
        if (!res.ok) return { content: `GitHub error (${res.status}). Check the token has 'repo' scope.`, citations: ["GitHub"] };
        const repos = (await res.json()) as Array<{ name: string; full_name: string; description: string | null; language: string | null; stargazers_count: number; updated_at: string }>;
        const filtered = query ? repos.filter((r) => (r.name + " " + (r.description ?? "")).toLowerCase().includes(query)) : repos;
        if (filtered.length === 0) return { content: "No GitHub repositories matched.", citations: ["GitHub"] };
        const text = filtered
          .slice(0, 20)
          .map((r) => `- ${r.full_name} · ${r.language ?? "?"} · ★${r.stargazers_count} · updated ${r.updated_at.slice(0, 10)}\n  ${r.description ?? ""}`)
          .join("\n");
        return { content: `GitHub repositories (${filtered.length} shown of ${repos.length}):\n${text}`, citations: ["GitHub"] };
      }

      const repo = typeof args.repo === "string" ? args.repo : "";
      if (!repo.includes("/")) {
        return { content: "For repo_info/list_files, provide 'repo' as 'owner/name'.", citations: ["GitHub"] };
      }

      if (mode === "repo_info") {
        const res = await fetch(`${GITHUB_API}/repos/${repo}`, { headers });
        if (!res.ok) return { content: `GitHub error (${res.status}) fetching ${repo}.`, citations: ["GitHub"] };
        const r = (await res.json()) as Record<string, unknown>;
        return {
          content: `Repo ${repo}:\n- Description: ${r.description ?? "—"}\n- Language: ${r.language ?? "—"}\n- Stars: ${r.stargazers_count}\n- Default branch: ${r.default_branch}\n- Updated: ${String(r.updated_at).slice(0, 10)}`,
          citations: ["GitHub"],
        };
      }

      // list_files
      const res = await fetch(`${GITHUB_API}/repos/${repo}/contents/`, { headers });
      if (!res.ok) return { content: `GitHub error (${res.status}) listing files for ${repo}.`, citations: ["GitHub"] };
      const items = (await res.json()) as Array<{ name: string; type: string; path: string }>;
      const text = items.map((i) => `- [${i.type}] ${i.path}`).join("\n");
      return { content: `Top-level contents of ${repo}:\n${text}`, citations: ["GitHub"] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: `GitHub request failed: ${msg}`, citations: ["GitHub"] };
    }
  },
};
