import { createDbClient } from "@/lib/db/client";
import { getUser } from "@/lib/auth";
import { moduleLogger } from "@/lib/log";
import type { ChatSession, Message } from "./sessions";

const log = moduleLogger("chat");

// Server-side durable persistence for chatbot conversations. This is the
// background tier of the two-tier write strategy (localStorage is the instant
// tier). It writes to the local SQLite DB via the same `from()` builder used by
// jobs/contacts, so calls are `user_id`-scoped and go to the app's SQLite file
// (e.g. Documents/atTrack/attrack.db in the desktop app).

// Messages are sent as a flat array with their session id so a single upsert
// call can reconcile the whole conversation. We store each message row with a
// stable id (the message id) so re-saves upsert rather than duplicate.

export interface PersistSessionInput {
  session: ChatSession;
  messages: Message[];
}

export async function upsertSessionToDb(input: PersistSessionInput): Promise<void> {
  const { userId } = await getUser();
  const client = await createDbClient();
  const s = input.session;

  await client.from("chat_sessions").upsert({
    id: s.id,
    user_id: userId,
    title: s.title,
    model: s.model,
    persona_id: s.personaId ?? null,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
    is_pinned: s.isPinned ? 1 : 0,
    connected_source_ids: s.connectedSourceIds ?? [],
  });

  // 1. Reconcile messages: delete any existing message rows for this session
  // that are no longer in input.messages (e.g. after edit/trim/fork).
  const currentIds = new Set(input.messages.map((m) => m.id));
  const { data: existingRows } = await client
    .from("chat_messages")
    .select("id")
    .eq("session_id", s.id)
    .eq("user_id", userId);

  if (existingRows && existingRows.length > 0) {
    for (const row of existingRows) {
      const rowId = (row as { id: string }).id;
      if (!currentIds.has(rowId)) {
        await client.from("chat_messages").delete().eq("id", rowId).eq("user_id", userId);
      }
    }
  }

  // 2. Upsert each current message with its sequential position.
  for (const [index, m] of input.messages.entries()) {
    await client.from("chat_messages").upsert({
      id: m.id,
      session_id: s.id,
      user_id: userId,
      role: m.role,
      content: m.content,
      feedback: m.feedback ?? null,
      seq: index,
      created_at: m.createdAt ?? new Date().toISOString(),
      thinking: m.thinking ?? null,
      sources: m.sources ? JSON.stringify(m.sources) : null,
      tool_calls: m.toolSteps ? JSON.stringify(m.toolSteps) : null,
    });
  }
}

export async function loadSessionsFromDb(): Promise<ChatSession[]> {
  const { userId } = await getUser();
  const client = await createDbClient();

  const { data: sessions } = await client
    .from("chat_sessions")
    .select("id, title, model, persona_id, created_at, updated_at, is_pinned, connected_source_ids")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  const { data: messages } = await client
    .from("chat_messages")
    .select("id, session_id, role, content, feedback, seq, created_at, thinking, sources, tool_calls")
    .eq("user_id", userId);

  // Order primarily by array position (seq), with chronological and role tiebreakers.
  const ordered = [...(messages ?? [])].sort((a, b) => {
    if (a.seq != null && b.seq != null && a.seq !== b.seq) {
      return Number(a.seq) - Number(b.seq);
    }
    const timeA = String(a.created_at ?? "");
    const timeB = String(b.created_at ?? "");
    if (timeA && timeB && timeA !== timeB) {
      return timeA.localeCompare(timeB);
    }
    if (a.role !== b.role) {
      return a.role === "user" ? -1 : 1;
    }
    return 0;
  });

  const bySession = new Map<string, Message[]>();
  for (const row of ordered) {
    const list = bySession.get(row.session_id) ?? [];
    let sources: string[] | undefined;
    if (row.sources) {
      try {
        sources = typeof row.sources === "string" ? JSON.parse(row.sources) : row.sources;
      } catch {
        /* ignore invalid JSON */
      }
    }
    let toolSteps: Message["toolSteps"];
    if (row.tool_calls) {
      try {
        toolSteps = typeof row.tool_calls === "string" ? JSON.parse(row.tool_calls) : row.tool_calls;
      } catch {
        /* ignore invalid JSON */
      }
    }

    list.push({
      id: row.id,
      role: row.role,
      content: row.content ?? "",
      feedback: (row.feedback as "up" | "down" | null) ?? null,
      createdAt: row.created_at,
      thinking: row.thinking ?? undefined,
      sources,
      toolSteps,
    });
    bySession.set(row.session_id, list);
  }

  const result: ChatSession[] = (sessions ?? []).map((s) => ({
    id: s.id,
    title: s.title,
    model: s.model,
    personaId: s.persona_id,
    createdAt: s.created_at,
    updatedAt: s.updated_at,
    isPinned: Boolean(s.is_pinned),
    category: "recent",
    connectedSourceIds: Array.isArray(s.connected_source_ids) ? s.connected_source_ids : [],
    messages: bySession.get(s.id) ?? [],
  }));

  return result;
}

/**
 * Permanently hard deletes a chat session and its messages from SQLite,
 * cleans up any associated vector chunks, while leaving extracted ai_memories and vec_memories intact.
 */
export async function deleteSessionFromDb(sessionId: string): Promise<void> {
  const { userId } = await getUser();
  const client = await createDbClient();

  // 1. Delete messages belonging to session
  await client
    .from("chat_messages")
    .delete()
    .eq("session_id", sessionId)
    .eq("user_id", userId);

  // 2. Delete session record
  await client
    .from("chat_sessions")
    .delete()
    .eq("id", sessionId)
    .eq("user_id", userId);

  // 3. Clean up associated vector chunks
  try {
    const { deleteEntityChunks } = await import("@/lib/ai/embeddings");
    deleteEntityChunks(userId, sessionId);
  } catch (err) {
    log.warn({ err, sessionId }, "Failed to delete chat session vector chunks:");
  }
}

/**
 * Permanently deletes all chat sessions and messages for the current user,
 * cleans up vector chunks, while strictly preserving ai_memories and vec_memories.
 */
export async function clearAllSessionsFromDb(): Promise<void> {
  const { userId } = await getUser();
  const client = await createDbClient();

  const { data: sessions } = await client
    .from("chat_sessions")
    .select("id")
    .eq("user_id", userId);

  const sessionIds = (sessions ?? []).map((s: Record<string, unknown>) => String(s.id));

  // 1. Delete all chat messages for this user
  await client
    .from("chat_messages")
    .delete()
    .eq("user_id", userId);

  // 2. Delete all chat sessions for this user
  await client
    .from("chat_sessions")
    .delete()
    .eq("user_id", userId);

  // 3. Clean up vector chunks for all deleted sessions
  try {
    const { deleteEntityChunks } = await import("@/lib/ai/embeddings");
    for (const sid of sessionIds) {
      deleteEntityChunks(userId, sid);
    }
  } catch (err) {
    log.warn({ err, sessionCount: sessionIds.length }, "Failed to delete chat session vector chunks:");
  }
}

