import { getBoard } from "@/lib/actions/board";
import type { RetrievedDoc } from "./types";

// Per §6 of the workflow spec: token caps.
const JOB_SUMMARY_CAP = 25;
const JOB_DETAIL_CAP = 3; // max full-detail jobs expanded

/** Summary rows for job_list intent. */
export async function getJobsSummary(userId: string): Promise<RetrievedDoc[]> {
  const board = await getBoard().catch(() => null);
  const cards = board?.cards ?? [];
  const listMap = new Map((board?.lists ?? []).map((l) => [l.id, l.name]));
  const docs: RetrievedDoc[] = [];

  cards.slice(0, JOB_SUMMARY_CAP).forEach((card) => {
    const stage = card.list_id ? listMap.get(card.list_id) || card.list_id : "Saved";
    const deadline = [card.deadline, card.section_deadline].filter(Boolean).join(" / ");
    const text = [
      `Title: ${card.title}`,
      card.company_name ? `Company: ${card.company_name}` : null,
      `Stage: ${stage}`,
      card.state ? `State: ${card.state}` : null,
      deadline ? `Deadline: ${deadline}` : "Deadline: none set",
      card.match_score != null ? `Match score: ${card.match_score}%` : null,
    ]
      .filter(Boolean)
      .join("\n");
    docs.push({
      source: "jobs",
      id: `job:${card.id}`,
      title: `${card.title}${card.company_name ? ` @ ${card.company_name}` : ""}`,
      text,
      citeRef: `job:${card.id}`,
    });
  });
  void userId; // scoping handled inside getBoard()
  return docs;
}

/**
 * Full-detail expansion for job_detail intent. If a specific title/company is
 * referenced, filter to the best matches; otherwise expand the most recent few.
 */
export async function getJobDetails(
  userId: string,
  query: string
): Promise<{ docs: RetrievedDoc[]; dropped: string[] }> {
  const board = await getBoard().catch(() => null);
  const cards = board?.cards ?? [];
  const listMap = new Map((board?.lists ?? []).map((l) => [l.id, l.name]));

  const q = query.toLowerCase();
  let selected = cards;
  const matched = cards.filter(
    (c) =>
      c.title.toLowerCase().includes(q) ||
      (c.company_name && c.company_name.toLowerCase().includes(q))
  );
  if (matched.length > 0) selected = matched;

  selected = selected.slice(0, JOB_DETAIL_CAP);
  const dropped: string[] = [];
  if (cards.length > JOB_DETAIL_CAP) {
    dropped.push(`Expanded ${selected.length} of ${cards.length} jobs (cap ${JOB_DETAIL_CAP}).`);
  }

  const docs: RetrievedDoc[] = selected.map((card) => {
    const stage = card.list_id ? listMap.get(card.list_id) || card.list_id : "Saved";
    const lines: string[] = [
      `Title: ${card.title}`,
      card.company_name ? `Company: ${card.company_name}` : null,
      `Stage: ${stage}`,
      card.state ? `State: ${card.state}` : null,
      card.deadline ? `Overall deadline: ${card.deadline}` : null,
      card.section_deadline ? `Section deadline: ${card.section_deadline}` : null,
      card.match_score != null ? `Match score: ${card.match_score}%` : null,
      card.application_status ? `Application status: ${card.application_status}` : null,
    ].filter(Boolean) as string[];
    return {
      source: "job_detail",
      id: `job:${card.id}`,
      title: `${card.title}${card.company_name ? ` @ ${card.company_name}` : ""}`,
      text: lines.join("\n"),
      citeRef: `job:${card.id}`,
    };
  });
  void userId;
  return { docs, dropped };
}
