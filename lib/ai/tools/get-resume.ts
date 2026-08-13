import type { ToolDefinition } from "./types";
import { getResumes } from "@/lib/ai-chatbot/retrieval/resumes";

/** LLM-callable: fetch the user's stored resumes/documents. */
export const getResumeTool: ToolDefinition = {
  name: "get_resume",
  sourceId: "resume",
  description:
    "Fetch the user's stored resumes/documents. Use when the user asks to review, tailor, or optimize a resume, or compare resumes for a specific application. Returns resume names and extracted text.",
  parameters: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "Optional resume name filter, e.g. 'Software Engineer Resume'.",
      },
    },
  },
  execute: async (_args, ctx) => {
    const docs = await getResumes(ctx.userId);
    const text = docs.map((d) => d.text).join("\n\n---\n\n");
    return {
      content: docs.length
        ? `User's resumes (${docs.length}):\n\n${text}`
        : "The user has no resumes stored.",
      citations: ["Resume"],
    };
  },
};
