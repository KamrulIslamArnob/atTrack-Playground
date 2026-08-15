import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { createDbClient } from "@/lib/db/client";

/**
 * POST /api/chat/feedback
 * Records user feedback (thumbs up / thumbs down) in both the dedicated `ai_feedback`
 * table and the message's `chat_messages.feedback` field.
 */
export async function POST(req: Request) {
  try {
    const { userId } = await getUser();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { sessionId, messageId, rating, model, personaId, messageContent } = body;

    if (!messageId) {
      return NextResponse.json({ error: "Missing messageId" }, { status: 400 });
    }

    const client = await createDbClient();

    if (rating === "up" || rating === "down") {
      // Upsert into dedicated AI feedback table for analytics and model evaluation
      await client.from("ai_feedback").upsert({
        id: `fb_${messageId}`,
        user_id: userId,
        session_id: sessionId || "unknown",
        message_id: messageId,
        rating,
        model: model || null,
        persona_id: personaId || null,
        message_content: messageContent ? String(messageContent).slice(0, 4000) : null,
        created_at: new Date().toISOString(),
      });

      // Update message row parameter
      await client
        .from("chat_messages")
        .update({ feedback: rating })
        .eq("id", messageId)
        .eq("user_id", userId);

      return NextResponse.json({ ok: true, rating });
    } else {
      // Rating removed / reset
      await client
        .from("ai_feedback")
        .delete()
        .eq("message_id", messageId)
        .eq("user_id", userId);

      await client
        .from("chat_messages")
        .update({ feedback: null })
        .eq("id", messageId)
        .eq("user_id", userId);

      return NextResponse.json({ ok: true, rating: null });
    }
  } catch (err) {
    console.error("[chat/feedback] failed to save feedback:", err);
    return NextResponse.json({ ok: false, error: "feedback_save_failed" }, { status: 500 });
  }
}

/**
 * GET /api/chat/feedback
 * Returns user's feedback history & quality metrics.
 */
export async function GET() {
  try {
    const { userId } = await getUser();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const client = await createDbClient();
    const { data: feedbackList } = await client
      .from("ai_feedback")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    return NextResponse.json({ ok: true, feedback: feedbackList ?? [] });
  } catch (err) {
    console.error("[chat/feedback] load failed:", err);
    return NextResponse.json({ ok: false, feedback: [] }, { status: 500 });
  }
}
