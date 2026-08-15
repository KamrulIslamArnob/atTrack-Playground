import type { ToolDefinition } from "./types";
import { getMemoriesRetrieved } from "@/lib/ai-chatbot/retrieval/memories";

/** LLM-callable: search user's stored custom markdown memories and persistent instructions. */
export const searchMemoriesTool: ToolDefinition = {
  name: "search_memories",
  sourceId: "memories",
  description:
    "Search or fetch the user's stored custom markdown memories, persistent notes, and personal guidelines. Use when the user asks about saved knowledge, personal preferences, memories, notes, or background context. Returns memory title and markdown content.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Optional filter term to search memories by keyword or title.",
      },
    },
  },
  execute: async (args, ctx) => {
    const query = typeof args.query === "string" ? args.query : "";
    const docs = await getMemoriesRetrieved(ctx.userId, query);
    const text = docs.map((d) => d.text).join("\n\n---\n\n");
    return {
      content: docs.length
        ? `User's Stored Memories (${docs.length}):\n\n${text}`
        : "No matching memories found in the user's store.",
      citations: ["AI Memories"],
    };
  },
};
