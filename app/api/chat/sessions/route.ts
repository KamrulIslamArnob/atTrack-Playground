import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import {
  upsertSessionToDb,
  loadSessionsFromDb,
  deleteSessionFromDb,
  clearAllSessionsFromDb,
} from "@/lib/ai-chatbot/persistence";
import type { ChatSession, Message } from "@/lib/ai-chatbot/sessions";

// PUT /api/chat/sessions  -> background durable write to SQLite.
// Called (debounced, fire-and-forget) by the client after every local save.
// Never blocks the chat UI; errors are swallowed (localStorage remains the
// instant source of truth).
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

// GET /api/chat/sessions -> load durable sessions from SQLite (source of truth
// on app open, reconciled against localStorage by the client).
export async function GET() {
  try {
    const { userId } = await getUser();
    const sessions = await loadSessionsFromDb();
    return NextResponse.json({ userId, sessions });
  } catch (err) {
    console.error("[chat/sessions] load failed:", err);
    return NextResponse.json({ userId: null, sessions: [] }, { status: 200 });
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
