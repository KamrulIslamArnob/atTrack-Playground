import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { scheduleJobScore, scheduleJobEnrich } from "@/lib/ai/background";
import { verifyExtensionAuth } from "@/lib/db/extension-secret";

import { getExtensionCorsHeaders } from "@/lib/db/extension-cors";
import { moduleLogger } from "@/lib/log";
import { withRoute } from "@/lib/log/route";

const log = moduleLogger("api");

export const OPTIONS = withRoute("/api/extension/add-job", async (req: Request) => {
  return new NextResponse(null, {
    status: 204,
    headers: getExtensionCorsHeaders(req),
  });
});

export const POST = withRoute("/api/extension/add-job", async (req: Request) => {
  const corsHeaders = getExtensionCorsHeaders(req);
  try {
    const { supabase, userId } = await getUser();

    if (!verifyExtensionAuth(req.headers.get("authorization"), userId)) {
      return NextResponse.json(
        { error: "Couldn't verify the extension token. Paste the secret from atTrack Settings into the extension popup." },
        { status: 401, headers: corsHeaders }
      );
    }

    const body = await req.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const companyName = typeof body.company === "string" ? body.company.trim() : "";

    if (!title || !companyName) {
      return NextResponse.json(
        { error: "Both job title and company name are required." },
        { status: 400, headers: corsHeaders }
      );
    }

    const applicationUrl = typeof body.application_url === "string" ? body.application_url.trim() : (typeof body.url === "string" ? body.url.trim() : null);
    const location = typeof body.location === "string" ? body.location.trim() : null;
    const salaryRange = typeof body.salary_range === "string" ? body.salary_range.trim() : null;
    const description = typeof body.description === "string" ? body.description.trim() : null;
    const employmentType = typeof body.employment_type === "string" ? body.employment_type.trim() : null;
    const workLocation = typeof body.work_location === "string" ? body.work_location.trim() : null;
    const source = typeof body.source === "string" ? body.source.trim() : "Chrome Extension";
    const skillsList = Array.isArray(body.skills) ? body.skills.map((s: unknown) => String(s).trim()).filter(Boolean) : [];

    const notes: Array<{ title: string; bullets: string[] }> = [];
    if (skillsList.length > 0) {
      notes.push({ title: "Skills", bullets: skillsList });
    }

    // Parse or calculate deadline
    const deadline = typeof body.deadline === "string" && body.deadline.trim() ? body.deadline.trim() : "unknown";

    // Find or create company
    let companyId: string;
    const { data: existingCompany } = await supabase
      .from("companies")
      .select("id")
      .eq("user_id", userId)
      .eq("name", companyName)
      .maybeSingle();

    if (existingCompany) {
      companyId = existingCompany.id;
    } else {
      const { data: newCompany, error: companyError } = await supabase
        .from("companies")
        .insert({ user_id: userId, name: companyName })
        .select("id")
        .single();

      if (companyError || !newCompany) {
        return NextResponse.json(
          { error: "Failed to create company." },
          { status: 500, headers: corsHeaders }
        );
      }
      companyId = newCompany.id;
    }

    // Find Wishlist board list
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

    // Insert job into database
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .insert({
        user_id: userId,
        company_id: companyId,
        title,
        application_url: applicationUrl || null,
        location: location || null,
        salary_range: salaryRange || null,
        description: description || null,
        employment_type: employmentType || null,
        work_location: workLocation || null,
        source: source || "Chrome Extension",
        // status is derived from list_id by trg_jobs_status_from_list_ins —
        // do not set it directly (CLAUDE.md invariant).
        deadline,
        notes: notes.length > 0 ? notes : null,
        list_id: wishlistList?.id ?? null,
        board_position: boardPosition,
      })
      .select("id")
      .single();

    if (jobError || !job) {
      log.error({ err: jobError }, "[Extension API] Job insert error:");
      return NextResponse.json(
        { error: jobError?.message || "Failed to insert job into database." },
        { status: 500, headers: corsHeaders }
      );
    }

    // Background: match score + AI cleanup into atTrack's full job shape —
    // both queued, neither blocks this response.
    scheduleJobScore(userId, job.id);
    scheduleJobEnrich(userId, job.id);

    // Revalidate paths
    revalidatePath("/jobs");
    revalidatePath("/board");

    return NextResponse.json(
      {
        success: true,
        jobId: job.id,
        message: "Job added to Wishlist successfully!",
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500, headers: corsHeaders }
    );
  }
});
