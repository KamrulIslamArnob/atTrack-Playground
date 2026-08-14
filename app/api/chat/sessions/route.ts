import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import {
  upsertSessionToDb,
  loadSessionsFromDb,
  deleteSessionFromDb,
  clearAllSessionsFromDb,
} from "@/lib/ai-chatbot/persistence";
import type { ChatSession, Message } from "@/lib/ai-chatbot/sessions";

// PUT /api/chat/sessions  -> durable write to SQLite.
// Awaited by the client on every session mutation. SQLite is the authority for
// chat history, so a failure here has to reach the caller: it reports 500 and
// the client surfaces it rather than showing a save that never happened.
export async function PUT(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const session = body?.session as ChatSession | undefined;
    const messages = (body?.messages as Message[] | undefined) ?? session?.messages ?? [];

    if (!session || !session.id) {
      return NextResponse.json({ error: "missing session" }, { status: 400 });
    }

    await upsertSessionToDb({ session, messages });
    return NextResponse.json({ ok: true });
  } catch (err) {
    // Reported as a real failure. This used to return 200 with {ok:false},
    // which made a total write failure look identical to a successful save to
    // every caller that checks `res.ok` — the client then told the user their
    // chat was saved when nothing had been written.
    console.error("[chat/sessions] durable upsert failed:", err);
    return NextResponse.json({ ok: false, error: "upsert_failed" }, { status: 500 });
  }
}

// GET /api/chat/sessions -> load durable sessions from SQLite, the authority
// for chat history on app open.
export async function GET() {
  try {
    const { userId } = await getUser();
    const sessions = await loadSessionsFromDb();
    return NextResponse.json({ userId, sessions });
  } catch (err) {
    // Reported as a real failure, for the same reason PUT is. Returning 200
    // with an empty list made a failed read indistinguishable from "no chats
    // yet": the client concluded it was a first run, built a fresh session and
    // wrote it over the localStorage mirror, blanking a sidebar whose history
    // was still sitting in the database. A 5xx makes `fetchSessions()` throw,
    // and the load path already falls back to the mirror on a throw.
    console.error("[chat/sessions] load failed:", err);
    return NextResponse.json({ error: "load_failed" }, { status: 500 });
  }
}

// DELETE /api/chat/sessions -> permanent hard delete of session and associated vectors.
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const idFromQuery = searchParams.get("id");
    const clearAllFromQuery = searchParams.get("all") === "true";

    const body = await req.json().catch(() => ({}));
    const idFromBody = body?.sessionId || body?.id;
    const clearAllFromBody = Boolean(body?.clearAll);

    const isClearAll = clearAllFromQuery || clearAllFromBody;
    const targetId = idFromQuery || idFromBody;

    if (isClearAll) {
      await clearAllSessionsFromDb();
      return NextResponse.json({ ok: true, clearedAll: true });
    }

    if (!targetId) {
      return NextResponse.json({ error: "missing session id" }, { status: 400 });
    }

    await deleteSessionFromDb(targetId);
    return NextResponse.json({ ok: true, deletedId: targetId });
  } catch (err) {
    console.error("[chat/sessions] delete failed:", err);
    return NextResponse.json({ ok: false, error: "delete_failed" }, { status: 500 });
  }
}
