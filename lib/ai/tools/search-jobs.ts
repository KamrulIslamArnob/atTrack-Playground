import type { ToolDefinition } from "./types";
import { getJobsSummary } from "@/lib/ai-chatbot/retrieval/jobs";

/** LLM-callable: search the user's job board / applications. */
export const searchJobsTool: ToolDefinition = {
  name: "search_jobs",
  sourceId: "jobs",
  description:
    "Search the user's job applications board. Use when the user asks about jobs to apply for, deadlines, application status, match scores, or what to prioritize. Returns a structured list of jobs with stages, deadlines, and match scores.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Optional free-text filter, e.g. 'remote frontend' or 'deadline this week'.",
      },
      stage: {
        type: "string",
        description: "Optional board stage filter, e.g. 'Applied', 'Interview', 'Preparing'.",
      },
    },
  },
  execute: async (_args, ctx) => {
    const docs = await getJobsSummary(ctx.userId);
    const text = docs.map((d) => d.text).join("\n\n");
    return {
      content: docs.length
        ? `User's job applications (${docs.length}):\n\n${text}`
        : "The user has no job applications recorded in their board.",
      citations: ["Job Applications"],
    };
  },
};
