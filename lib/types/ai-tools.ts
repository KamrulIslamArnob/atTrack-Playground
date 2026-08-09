// The 8 email-shaped AI Tools kinds (job-detail-sheet AI Tools tab). Every kind
// shares the same generate -> edit -> send-or-save flow; only the system
// prompt's "purpose" paragraph differs per kind (app/api/ai/generate-ai-tool).

export const AI_TOOL_KINDS = [
  { kind: "cover_letter", label: "Cover Letter", stage: "Application" },
  { kind: "follow_up_application", label: "Follow Up After Application", stage: "Application" },
  { kind: "reschedule_interview", label: "Reschedule Interview", stage: "Interview" },
  { kind: "follow_up_interview", label: "Follow Up After Interview", stage: "Interview" },
  { kind: "offer_negotiation", label: "Offer Negotiation", stage: "Offer" },
  { kind: "offer_acceptance", label: "Offer Acceptance", stage: "Offer" },
  { kind: "offer_decline", label: "Offer Decline", stage: "Offer" },
  { kind: "offer_time_extension", label: "Offer Time Extension Request", stage: "Offer" },
] as const;

export type AiToolKind = (typeof AI_TOOL_KINDS)[number]["kind"];

export function aiToolLabel(kind: string): string {
  return AI_TOOL_KINDS.find((k) => k.kind === kind)?.label ?? kind;
}
