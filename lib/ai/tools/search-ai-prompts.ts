import type { ToolDefinition } from "./types";
import { getAiToolPrompts } from "@/lib/ai-chatbot/retrieval/prompts";

/** LLM-callable: fetch the inbuilt AI-prompt database. */
export const searchAiPromptsTool: ToolDefinition = {
  name: "search_ai_prompts",
  sourceId: "ai_prompts",
  description:
    "Search the user's inbuilt AI-prompt database (saved reusable system prompts). Use when the user wants to apply one of their saved prompt templates or asks about a stored prompt. Returns prompt name, category, and content.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Optional filter, e.g. 'cold email' or 'resume bullet'.",
      },
    },
  },
  execute: async (_args, ctx) => {
    const docs = await getAiToolPrompts(ctx.userId);
    const text = docs.map((d) => d.text).join("\n\n");
    return {
      content: docs.length
        ? `User's AI prompts (${docs.length}):\n\n${text}`
        : "The user has no AI prompts stored.",
      citations: ["AI Prompts"],
    };
  },
};
