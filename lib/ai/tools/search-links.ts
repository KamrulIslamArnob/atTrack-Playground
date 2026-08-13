import type { ToolDefinition } from "./types";
import { getSocialLinks } from "@/lib/ai-chatbot/retrieval/social";

/** LLM-callable: fetch saved links / bookmarks and social URLs. */
export const searchLinksTool: ToolDefinition = {
  name: "search_links",
  sourceId: "links",
  description:
    "Fetch the user's saved links, bookmarks, and social/profile URLs. Use when the user references a saved resource, a portfolio link, or a social profile. Returns link title, URL, and category.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Optional filter, e.g. 'github' or 'portfolio'.",
      },
    },
  },
  execute: async (_args, ctx) => {
    const docs = await getSocialLinks(ctx.userId);
    const text = docs.map((d) => d.text).join("\n\n");
    return {
      content: docs.length
        ? `User's links (${docs.length}):\n\n${text}`
        : "The user has no saved links.",
      citations: ["Social Links"],
    };
  },
};
