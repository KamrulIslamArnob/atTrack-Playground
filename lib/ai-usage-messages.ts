export interface AiUsageLogLike {
  action: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  duration_ms: number | null;
  metadata: Record<string, unknown>;
}

export const AI_ACTION_LABELS: Record<string, string> = {
  extract_job: "Job extraction",
  extract_resume: "Resume extraction",
  match_score: "Match score",
  generate_mcq: "MCQ generation",
  generate_email: "Email generation",
  generate_ai_tool: "AI Tools generation",
};

export const AI_ACTION_COLORS: Record<string, string> = {
  extract_job: "bg-cyan-100 text-cyan-700",
  extract_resume: "bg-blue-100 text-blue-700",
  match_score: "bg-violet-100 text-violet-700",
  generate_mcq: "bg-amber-100 text-amber-700",
  generate_email: "bg-emerald-100 text-emerald-700",
  generate_ai_tool: "bg-pink-100 text-pink-700",
};

function firstString(metadata: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = metadata[key];
    if (value != null && value !== "") return String(value);
  }
  return null;
}

export function formatAiUsageMessage(log: AiUsageLogLike): string {
  const meta = log.metadata ?? {};
  const status = meta.status === "error" ? "Failed" : null;

  const withContext = (base: string): string => {
    const context = firstString(meta, ["job_title", "title", "name", "company"]);
    return context ? `${base} for "${context}"` : base;
  };

  let message: string;
  switch (log.action) {
    case "extract_job":
      message = withContext("Extracted job details");
      break;
    case "extract_resume":
      message = withContext("Extracted resume details");
      break;
    case "match_score":
      message = withContext("Calculated match score");
      break;
    case "generate_mcq":
      message = withContext("Generated MCQ questions");
      break;
    case "generate_email":
      message = withContext("Generated application email");
      break;
    case "generate_ai_tool": {
      const kind = firstString(meta, ["kind"]);
      message = withContext(kind ? `Generated ${kind.replace(/_/g, " ")} email` : "Generated AI Tools email");
      break;
    }
    default:
      message = AI_ACTION_LABELS[log.action] ?? log.action;
  }

  const detail = firstString(meta, ["detail"]);
  if (detail) message = `${message} (${detail})`;

  return status ? `${status}: ${message}` : message;
}
