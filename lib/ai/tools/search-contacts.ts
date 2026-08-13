import type { ToolDefinition } from "./types";
import { getContactsRetrieved } from "@/lib/ai-chatbot/retrieval/crm";

/** LLM-callable: search CRM contacts for outreach. */
export const searchContactsTool: ToolDefinition = {
  name: "search_contacts",
  sourceId: "contacts",
  description:
    "Search the user's CRM contacts (recruiters, hiring managers, referrals). Use when the user wants to draft outreach, follow-ups, or find who to message about a role. Returns contact name, company, role, email, and social links.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Optional filter, e.g. 'recruiter at google' or 'referral'.",
      },
    },
  },
  personas: ["outreach", "general"],
  execute: async (_args, ctx) => {
    const docs = await getContactsRetrieved(ctx.userId);
    const text = docs.map((d) => d.text).join("\n\n");
    return {
      content: docs.length
        ? `User's CRM contacts (${docs.length}):\n\n${text}`
        : "The user has no CRM contacts stored.",
      citations: ["CRM Contacts"],
    };
  },
};
