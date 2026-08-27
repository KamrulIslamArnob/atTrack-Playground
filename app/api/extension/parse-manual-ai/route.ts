import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { verifyExtensionAuth } from "@/lib/db/extension-secret";
import { getExtensionCorsHeaders } from "@/lib/db/extension-cors";
import { withRoute } from "@/lib/log/route";
import { moduleLogger } from "@/lib/log";
import { cleanAiErrorMessage } from "@/lib/ai/error-formatter";
import { scheduleManualAiEnrich } from "@/lib/ai/background";

const log = moduleLogger("api.parse-manual-ai");

export const dynamic = "force-dynamic";

export const OPTIONS = withRoute("/api/extension/parse-manual-ai", async (req: Request) => {
  return new NextResponse(null, {
    status: 204,
    headers: getExtensionCorsHeaders(req),
  });
});

/**
 * Fire-and-forget AI Add: link + text + images are accepted together, a Wishlist
 * job is created immediately, and multimodal extraction (url_context + images +
 * pasted text) runs in the background queue. The popup only waits for the 200
 * "queued" ack, not the LLM round-trip — hence the instant "Sent to server"
 * confirmation.
 */
export const POST = withRoute("/api/extension/parse-manual-ai", async (req: Request) => {
  const corsHeaders = getExtensionCorsHeaders(req);
  try {
    const { supabase, userId } = await getUser();

    if (!verifyExtensionAuth(req.headers.get("authorization"), userId)) {
      return NextResponse.json(
        { error: "Couldn't verify the extension token. Paste the secret from BetterJob Settings into the extension popup." },
        { status: 401, headers: corsHeaders }
      );
    }

    const body = await req.json();
    const url = typeof body.url === "string" ? body.url.trim() : "";
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const rawImages: unknown = body.images;

    const imagesBase64: string[] = [];
    if (Array.isArray(rawImages)) {
      for (const item of rawImages) {
        if (typeof item !== "string" || !item) continue;
        const commaIdx = item.indexOf(",");
        if (item.startsWith("data:") && commaIdx !== -1) {
          const b64 = item.slice(commaIdx + 1).trim();
          if (b64) imagesBase64.push(b64);
        } else if (item.length > 100) {
          imagesBase64.push(item.trim());
        }
        if (imagesBase64.length >= 3) break;
      }
    }

    if (!url && !text && imagesBase64.length === 0) {
      return NextResponse.json(
        { error: "Provide a link, pasted text, or an image to extract." },
        { status: 400, headers: corsHeaders }
      );
    }

    log.info({ event: "parse-manual-ai.queued", hasUrl: !!url, hasText: !!text, imageCount: imagesBase64.length });

    // --- Create placeholder Wishlist job immediately (fast path) ---
    // Derive a quick title/company for the interim card so the board isn't blank while AI runs.
    let placeholderTitle = "AI Import — Processing";
    let placeholderCompany = "Unknown Company";

    if (text) {
      const firstLine = text.split("\n").map((l: string) => l.trim()).find((l: string) => l.length > 5 && l.length < 80);
      if (firstLine) placeholderTitle = firstLine.slice(0, 80);
    }
    if (!placeholderTitle || placeholderTitle === "AI Import — Processing") {
      try {
        if (url) {
          const u = new URL(url);
          const lastSeg = u.pathname.split("/").filter(Boolean).pop();
          if (lastSeg) placeholderTitle = decodeURIComponent(lastSeg.replace(/[-_]/g, " ")).slice(0, 80) || placeholderTitle;
          if (u.hostname) placeholderCompany = u.hostname.replace(/^www\./, "").split(".")[0] || placeholderCompany;
        }
      } catch {}
    }
    // Capitalize company placeholder
    if (placeholderCompany !== "Unknown Company") {
      placeholderCompany = placeholderCompany.charAt(0).toUpperCase() + placeholderCompany.slice(1);
    }

    // Find or create company
    let companyId: string;
    const { data: existingCompany } = await supabase
      .from("companies")
      .select("id")
      .eq("user_id", userId)
      .eq("name", placeholderCompany)
      .maybeSingle();

    if (existingCompany) {
      companyId = existingCompany.id;
    } else {
      const { data: newCompany, error: companyError } = await supabase
        .from("companies")
        .insert({ user_id: userId, name: placeholderCompany })
        .select("id")
        .single();
      if (companyError || !newCompany) {
        return NextResponse.json({ error: "Failed to create company." }, { status: 500, headers: corsHeaders });
      }
      companyId = newCompany.id;
    }

    // Find Wishlist list + next position
    const { data: wishlistList } = await supabase
      .from("board_lists")
      .select("id")
      .eq("user_id", userId)
      .eq("kind", "wishlist")
      .maybeSingle();

    let boardPosition: number | null = null;
    if (wishlistList) {
      const { data: last } = await supabase
        .from("jobs")
        .select("board_position")
        .eq("user_id", userId)
        .eq("list_id", wishlistList.id)
        .order("board_position", { ascending: false })
        .limit(1)
        .maybeSingle();
      boardPosition = (last?.board_position ?? -1) + 1;
    }

    // Minimal description for the interim card — AI will replace with structured one
    const interimDescription = [
      text ? `Pasted text:\n${text.slice(0, 4000)}` : null,
      url ? `Source: ${url}` : null,
      imagesBase64.length > 0 ? `Images: ${imagesBase64.length} attached for AI analysis` : null,
      "Status: AI precalculation queued — this card will update automatically when the model finishes.",
    ]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 8000);

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .insert({
        user_id: userId,
        company_id: companyId,
        title: placeholderTitle,
        application_url: url || null,
        description: interimDescription || null,
        source: "AI Add (Queued)",
        deadline: "unknown",
        list_id: wishlistList?.id ?? null,
        board_position: boardPosition,
      })
      .select("id, title")
      .single();

    if (jobError || !job) {
      log.error({ err: jobError }, "[parse-manual-ai] Job insert failed:");
      return NextResponse.json({ error: jobError?.message || "Failed to queue job." }, { status: 500, headers: corsHeaders });
    }

    // Queue the heavy multimodal extraction — do not await. The job card exists already.
    try {
      scheduleManualAiEnrich(userId, job.id, imagesBase64, text, url);
      log.info({ event: "parse-manual-ai.enqueued", jobId: job.id, title: placeholderTitle });
    } catch (err) {
      log.error({ err }, "[parse-manual-ai] Failed to schedule enrichment — job will stay as placeholder:");
      // Still return success for the placeholder; worst case it stays un-enriched but is not lost.
    }

    return NextResponse.json(
      {
        success: true,
        queued: true,
        jobId: job.id,
        message: "Sent to server — AI precalculation queued. The card will update on your board shortly.",
        placeholderTitle,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    log.error({ err: error }, "[parse-manual-ai] Internal Exception:");
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? cleanAiErrorMessage(error.message) : "Internal manual AI parse error",
      },
      { status: 500, headers: corsHeaders }
    );
  }
});
