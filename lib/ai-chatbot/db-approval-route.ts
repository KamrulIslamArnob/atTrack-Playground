// Handles a user's Allow/Deny decision on a pending DELETE or WRITE approval.
// Invoked from /api/chat when the request carries a `dbApproval` body. Allow
// executes the previously-stored operation (owner-scoped); Deny discards it
// without ever running any SQL. Returns an SSE stream so the chat renders it
// as a normal assistant message. For writes, also returns the created artifact
// so the chat can show the inline card.
import { consumePendingDbDelete, executeApprovedDelete } from "./db-approval";
import { consumePendingWrite, executeApprovedWrite } from "./write-approval";
import { getDb } from "@/lib/db/sqlite";

export function handleDbApprovalRequest(
  approvalId: string,
  decision: "allow" | "deny",
  userId: string
): Response {
  const encoder = new TextEncoder();

  // Try pending WRITE first (ask/strict for write_database), then DELETE
  const pendingWrite = consumePendingWrite(approvalId, userId);
  if (pendingWrite) {
    // Use an async wrapper but handleDbApprovalRequest is sync — we need to
    // execute the write synchronously here. executeApprovedWrite is async
    // because it may call ensureApplication which uses createDbClient.
    // We handle it by returning a stream that will be filled asynchronously
    // via a Promise, but the function must stay sync for the route's
    // expectation. We therefore create a ReadableStream that does the async
    // work in its start() and enqueues when done.
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let text: string;
        let artifact: unknown = null;
        if (decision === "allow") {
          try {
            const result = await executeApprovedWrite(pendingWrite);
            text = result.content;
            // Build artifact snapshot for the newly created row so the UI can show the card
            try {
              const db = getDb();
              // Reuse the same snapshot builder as write-database.ts
              const table = pendingWrite.table;
              const rowId = (result.newId as string) ?? pendingWrite.values.id ?? pendingWrite.id ?? "";
              // Build minimal artifact inline (avoid importing the full builder to keep this route light)
              let snapshot: unknown = null;
              if (table === "jobs" && rowId) {
                const row = db
                  .prepare(
                    `SELECT j.id, j.title, j.state, j.location, j.employment_type, j.work_location, j.salary_range, j.salary_min, j.salary_max, j.created_at, j.list_id,
                            c.name as company_name, c.website as company_website, c.logo_url as company_logo_url, c.color as company_color,
                            bl.name as list_name, bl.kind as list_kind
                     FROM jobs j
                     LEFT JOIN companies c ON j.company_id = c.id
                     LEFT JOIN board_lists bl ON j.list_id = bl.id
                     WHERE j.id = ? AND j.user_id = ?`
                  )
                  .get(rowId, userId) as Record<string, unknown> | undefined;
                if (row) {
                  snapshot = {
                    id: row.id,
                    title: row.title,
                    company_name: row.company_name ?? null,
                    company_website: row.company_website ?? null,
                    company_logo_url: row.company_logo_url ?? null,
                    company_color: row.company_color ?? null,
                    location: row.location ?? null,
                    employment_type: row.employment_type ?? null,
                    work_location: row.work_location ?? null,
                    salary_range: row.salary_range ?? null,
                    salary_min: row.salary_min ?? null,
                    salary_max: row.salary_max ?? null,
                    state: row.state ?? null,
                    list_id: row.list_id ?? null,
                    list_name: row.list_name ?? null,
                    list_kind: row.list_kind ?? null,
                    created_at: row.created_at,
                  };
                  artifact = {
                    id: `artifact_${rowId}`,
                    kind: "job",
                    table,
                    rowId,
                    title: (snapshot as { title: string }).title,
                    subtitle: (snapshot as { company_name: string | null }).company_name ?? undefined,
                    snapshot,
                  };
                }
              }
            } catch {}
            if (!text) text = `Created ${pendingWrite.table} row.`;
          } catch (err) {
            text = `Failed to create ${pendingWrite.table} row: ${err instanceof Error ? err.message : String(err)}`;
          }
        } else {
          text = `Create cancelled — no rows were added to "${pendingWrite.table}".`;
        }

        // Emit approval result as text
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`)
        );
        // If we have an artifact, emit it as a tool_calls frame so the client can render the card
        if (artifact) {
          const toolCalls = [
            {
              id: `write_${pendingWrite.approvalId}`,
              name: "write_database",
              status: "completed",
              result: {
                content: text,
                artifact,
                artifacts: [artifact],
              },
            },
          ];
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ tool_calls: toolCalls })}\n\n`)
          );
        }
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

  const pending = consumePendingDbDelete(approvalId, userId);

  let text: string;
  if (!pending) {
    text =
      "That request has expired or was already handled. Ask me again if you still want to proceed.";
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
