import type { ToolDefinition } from "./types";
import { fetchUrlAsText } from "@/lib/ai/providers";

/**
 * Real web tool: fetch a concrete URL as plain text and return it to the model.
 * The model should only call this with a URL the user provided. Query-style web
 * search (Tavily/Serper) is a FUTURE tool requiring an API key — it is NOT
 * faked here, to avoid presenting non-functional tooling.
 */
export const webSearchTool: ToolDefinition = {
  name: "web_search",
  description:
    "Fetch the text content of a specific web URL the user mentioned (e.g. a job posting or article). Use only when the user supplies a concrete URL. Does not perform open-web search queries.",
  parameters: {
    type: "object",
    properties: {
      url: { type: "string", description: "The fully-qualified https URL to fetch." },
    },
    required: ["url"],
  },
  execute: async (args, _ctx) => {
    const url = typeof args.url === "string" ? args.url : "";
    if (!/^https?:\/\//i.test(url)) {
      return { content: "Invalid or missing URL; provide a concrete https URL.", citations: [] };
    }
    try {
      const text = await fetchUrlAsText(url);
      return {
        content: `Content of ${url}:\n\n${text.slice(0, 20000)}`,
        citations: ["Web"],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: `Failed to fetch ${url}: ${msg}`, citations: [] };
    }
  },
};
