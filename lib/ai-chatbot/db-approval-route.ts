// Handles a user's Allow/Deny decision on a pending DELETE approval. Invoked
// from /api/chat when the request carries a `dbApproval` body. Allow executes
// the previously-stored delete (owner-scoped); Deny discards it without ever
// running any SQL. Returns an SSE stream so the chat renders it as a normal
// assistant message.
import { consumePendingDbDelete, executeApprovedDelete } from "./db-approval";

export function handleDbApprovalRequest(
  approvalId: string,
  decision: "allow" | "deny",
  userId: string
): Response {
  const encoder = new TextEncoder();
  const pending = consumePendingDbDelete(approvalId, userId);

  let text: string;
  if (!pending) {
    text =
      "That delete request has expired or was already handled. Ask me to delete the rows again if you still want to.";
  } else if (decision === "allow") {
    const deleted = executeApprovedDelete(pending);
    text = `Deleted ${deleted} row(s) from "${pending.label}".`;
  } else {
    text = `Delete cancelled — no rows were removed from "${pending.label}".`;
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`)
      );
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
