import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { getBoard } from "@/lib/actions/board";
import { getDocuments } from "@/lib/actions/documents";
import { getContacts } from "@/lib/actions/contacts";
import { getLinksAndCategories } from "@/lib/actions/links";
import { getMemories } from "@/lib/actions/memories";
import { createDbClient } from "@/lib/db/client";
import { withRoute } from "@/lib/log/route";

/**
 * Returns a lightweight, user-scoped snapshot of the owner's workspace so the
 * chatbot can ground its answers in real atTrack data (jobs, resumes, contacts, memories).
 *
 * Privacy boundary: every read is scoped through getUser()'s userId — this is
 * a zero-auth single-owner app, so no query ever crosses user boundaries.
 */
export const GET = withRoute("/api/chat/workspace", async () => {
  try {
    const { userId } = await getUser();

    const [board, documents, contacts, linksData, memoriesList] = await Promise.all([
      getBoard().catch(() => null),
      getDocuments().catch(() => []),
      getContacts().catch(() => []),
      getLinksAndCategories().catch(() => ({ categories: [], links: [], shortcuts: [] })),
      getMemories().catch(() => []),
    ]);

    const links = (linksData?.links ?? []).map((l) => ({
      id: l.id,
      title: l.title,
      url: l.url,
      category: (l as { category_name?: string }).category_name ?? "",
    }));

    const memories = (memoriesList ?? []).map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      updatedAt: m.updated_at,
    }));

    // Inbuilt AI-prompt DB count (read-only, user-scoped).
    let promptCount = 0;
    try {
      const db = createDbClient();
      const { count } = await db
        .from("ai_tool_prompts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);
      promptCount = count ?? 0;
    } catch {
      promptCount = 0;
    }

    const listMap = new Map((board?.lists ?? []).map((l) => [l.id, l.name]));

    const jobs = (board?.cards ?? []).map((card) => {
      const stageName = card.list_id ? listMap.get(card.list_id) || card.list_id : "Saved";
      const deadlines = (card.deadlines ?? []).map((d) => ({
        id: d.id,
        title: d.title,
        type: d.type,
        dueDate: d.due_date,
        stageKind: d.stage_kind,
        isCompleted: d.is_completed,
        notes: d.notes,
      }));

      return {
        id: card.id,
        title: card.title,
        company: card.company_name,
        stage: stageName,
        state: card.state,
        deadline: card.deadline,
        sectionDeadline: card.section_deadline,
        deadlines,
        matchScore: card.match_score,
        resumeName: card.resume_name,
        applicationStatus: card.application_status,
      };
    });

    const resumes = documents
      .filter((d) => d.type === "resume" || d.generated_kind === "resume")
      .map((d) => ({
        id: d.id,
        name: d.name,
        isDefault: d.is_default,
        hasBuilderData: Boolean(d.builder_data),
        hasContent: Boolean(d.content),
      }));

    const people = (contacts ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      role: c.role,
      company: c.company_name,
    }));

    return NextResponse.json({
      userId,
      jobs,
      resumes,
      contacts: people,
      links,
      memories,
      aiToolPrompts: promptCount,
      counts: {
        jobs: jobs.length,
        resumes: resumes.length,
        contacts: people.length,
        links: links.length,
        memories: memories.length,
        aiToolPrompts: promptCount,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
});
