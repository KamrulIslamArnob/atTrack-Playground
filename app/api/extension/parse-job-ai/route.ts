import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { resolveProviderChain, resolveAllProviders, generateText } from "@/lib/ai/providers";
import { cleanAiErrorMessage } from "@/lib/ai/error-formatter";
import { scrapeWithFirecrawl } from "@/lib/services/firecrawl";
import { scrapeNative } from "@/lib/services/native-scrape";
import { verifyExtensionAuth } from "@/lib/db/extension-secret";

import { getExtensionCorsHeaders } from "@/lib/db/extension-cors";
import { moduleLogger } from "@/lib/log";
import { withRoute } from "@/lib/log/route";

const log = moduleLogger("api.parse-job-ai");

export const dynamic = "force-dynamic";

export const OPTIONS = withRoute("/api/extension/parse-job-ai", async (req: Request) => {
  return new NextResponse(null, {
    status: 204,
    headers: getExtensionCorsHeaders(req),
  });
});

export const POST = withRoute("/api/extension/parse-job-ai", async (req: Request) => {
  const corsHeaders = getExtensionCorsHeaders(req);
  try {
    const { userId } = await getUser();

    if (!verifyExtensionAuth(req.headers.get("authorization"), userId)) {
      return NextResponse.json(
        { error: "Couldn't verify the extension token. Paste the secret from BetterJob Settings into the extension popup." },
        { status: 401, headers: corsHeaders }
      );
    }

    const body = await req.json();
    const url = typeof body.url === "string" ? body.url.trim() : "";
    const pageText = typeof body.pageText === "string" ? body.pageText.trim() : "";
    const fullPageText = typeof body.fullPageText === "string" ? body.fullPageText.trim() : "";
    const html = typeof body.html === "string" ? body.html.trim() : "";
    const isCarrierPage = Boolean(body.isCarrierPage);
    const carrierMeta = typeof body.carrierMeta === "object" && body.carrierMeta ? body.carrierMeta : null;
    const layer1Data = typeof body.layer1Data === "object" && body.layer1Data ? body.layer1Data : {};
    const firecrawlApiKey =
      process.env.FIRECRAWL_API_KEY ||
      (typeof body.firecrawlApiKey === "string" && body.firecrawlApiKey.trim() ? body.firecrawlApiKey.trim() : undefined);

    if (!url && !pageText && !fullPageText && !html && !layer1Data.title) {
      return NextResponse.json(
        { error: "URL, page content, HTML snapshot, or Layer 1 data is required for parsing." },
        { status: 400, headers: corsHeaders }
      );
    }

    const hasDeepClientSnapshot = Boolean(html && html.length > 500) || Boolean(fullPageText && fullPageText.length > 500);

    // --- 1. Try Firecrawl API First if Key is Configured ---
    // Skip if we already have a rich client HTML snapshot — the user's DOM is more accurate than a server fetch for carrier pages.
    if (url && firecrawlApiKey && !hasDeepClientSnapshot) {
      const fcResult = await scrapeWithFirecrawl(url, firecrawlApiKey);
      if (fcResult.success && fcResult.data && fcResult.data.title) {
        return NextResponse.json(
          {
            success: true,
            aiParsedData: fcResult.data,
            provider: "firecrawl",
          },
          { headers: corsHeaders }
        );
      }
      log.warn(`[AI Scraper API] Firecrawl scrape failed or unconfigured. Trying native crawl...`);
    }

    // --- 2. Native Crawl Fallback (no key required) ---
    // Skip if we have deep client snapshot — no need to refetch what the browser already saw.
    if (url && !hasDeepClientSnapshot) {
      const nativeResult = await scrapeNative(url);
      if (nativeResult.success && nativeResult.data && nativeResult.data.title) {
        return NextResponse.json(
          {
            success: true,
            aiParsedData: nativeResult.data,
            provider: "native",
          },
          { headers: corsHeaders }
        );
      }
      log.warn(`[AI Scraper API] Native crawl found nothing usable. Falling back to local LLM provider chain...`);
    }

    // --- 3. AI-Native Deep Scraping — primary for carrier pages ---
    // This is the deep path: instead of capping text manually then asking AI to guess,
    // we give the LLM the full cleaned HTML snapshot + full page text + L1 carrier signals
    // and let it do the extraction. It sees tables/lists for Salary/Dept/Vacancy that regex capped away.
    const configuredChain = await resolveProviderChain(userId, "scraping");
    const allProviders = await resolveAllProviders(userId);
    const chain = [...configuredChain];
    for (const p of allProviders) {
      if (!chain.some((existing) => existing.id === p.id)) chain.push(p);
    }

    if (!chain || chain.length === 0) {
      log.warn(`[AI Scraper API] ⚠️ No active LLM provider chain found for user. Layer 1 offline DOM data will be used.`);
      return NextResponse.json(
        {
          success: false,
          reason: "NO_AI_PROVIDER",
          message: "No AI provider or Firecrawl key configured in BetterJob. Using Layer 1 offline DOM extraction.",
        },
        { headers: corsHeaders }
      );
    }

    const providerName = chain[0].name || chain[0].provider_type;
    log.info(`[AI Scraper API] 🤖 Deep AI scrape via "${providerName}" (Model: "${chain[0].model}") carrier=${isCarrierPage} html=${html.length} fullText=${fullPageText.length}`);

    // Build carrier-aware deep prompt
    const carrierHint = isCarrierPage
      ? `
This is a CARRIER / CAREER page (e.g. eximusedu.com/careers/..., bdjobs, Workday, Ashby, Lever). Carrier pages use explicit labeled fields:
- "Job Location:", "Location:", "Workplace:" → location
- "Salary:", "Compensation:", "Pay:", "Remuneration:" → salary_range (handle BDT/Tk. forms like "Compensation BDT 40K", "Salary: 30,000-50,000 BDT", "Tk. 40,000", "Negotiable", "BDT 40K per month")
- "Department:", "Dept:", "Functional Area:", "Category:", "Division:" → department (e.g. "where innovation meets purpose")
- "Vacancy:", "No. of Vacancies:", "Positions:", "Openings:" → vacancy count
- "Experience:", "Exp:", "Employment Status:", "Working time:", "Age:" → experience
- Tables or definition lists often hold these fields — read the HTML structure, not just flat text.
Take time to scan deeply for these carrier keywords; they are the most reliable signals on this page.`
      : "";

    const carrierMetaBlock = carrierMeta ? `\nCarrier quick signals (from DOM heuristic, may be partial):\n${JSON.stringify(carrierMeta, null, 2)}` : "";

    const htmlBlock = html ? `\n\nCleaned HTML snapshot (client-rendered, carrier structure preserved — tables/lists/headings matter):\n${html.slice(0, 18000)}` : "";

    const fullTextBlock = fullPageText ? `\n\nFull page text (untruncated, 15000 chars — includes every labeled field):\n${fullPageText.slice(0, 15000)}` : "";

    const layer1Block = Object.keys(layer1Data).length > 0 ? `\n\nLayer 1 heuristic signals (fast DOM, may be incomplete — use as hints, not truth):\n${JSON.stringify(layer1Data, null, 2).slice(0, 6000)}` : "";

    const prompt = `You are an expert technical recruiter and AI job parser specializing in deep scraping of carrier/career pages.

Analyze this job posting content with DEEP, PATIENT extraction. Do not cap or shortcut — scan every field, especially carrier-specific labeled ones.
${carrierHint}

URL: ${url}

Page Text (heuristic snippet):
${pageText.slice(0, 8000)}
${fullTextBlock}
${htmlBlock}
${carrierMetaBlock}
${layer1Block}

Deep scraping rules:
1. Carrier keywords above are your primary anchors — extract them even if they appear in a table or list far from the title.
2. Salary: Understand all Bangladesh forms — "Compensation BDT 40K" → salary_range "BDT 40K", "BDT 30,000 - 50,000", "Tk. 40,000", "Negotiable" are all valid. If salary is a range, set salary_min/salary_max as numbers (40K → 40000). If only BDT label without numbers, keep salary_range as the raw label.
3. Department/Team/Category: capture verbatim (e.g. "where innovation meets purpose").
4. Location: prefer "Job Location:" label over generic page footer.
5. Employment type: map to "Full-time" | "Part-time" | "Contract" | "Internship" (default Full-time).
6. Work location: map to "Remote" | "Hybrid" | "On-site" (infer from text if labeled field missing).
7. Skills: extract 5-15 technical keywords (e.g. PostgreSQL, MySQL, AWS, Git, CSE, RDBMS, jQuery) — look in Responsibilities/Requirements sections.
8. Description: produce a structured summary (2-4 paragraphs) + keep key requirements, not a one-liner.
9. If a field truly not found, use null — never hallucinate.

Return ONLY a valid JSON object in this exact format:
{
  "title": "Job Title",
  "company": "Company Name",
  "location": "City, State/Country or Remote",
  "salary_range": "BDT 40K or $120,000 - $150,000 or null",
  "salary_min": 40000,
  "salary_max": null,
  "employment_type": "Full-time",
  "work_location": "On-site",
  "description": "Structured job summary and responsibilities (keep carrier dept/vacancy hints if useful)...",
  "skills": ["PostgreSQL", "MySQL", "AWS", "Git", "CSE"],
  "benefits": ["Health Insurance", "401k Match"],
  "contact_name": "Recruiter/Hiring Manager Name if mentioned, else null",
  "contact_email": "Recruiter email if mentioned, else null",
  "contact_role": "Recruiter",
  "department": "Dept where innovation meets purpose or null",
  "vacancy": "2 or null",
  "experience": "Exp: writing queries in RDBMS (MySQL/PostgreSQL) or null"
}
IMPORTANT: Output ONLY the raw JSON object, no markdown commentary.`;

    const result = await generateText(
      chain,
      { userPrompt: prompt },
      { userId, action: "extension_ai_parse_job", metadata: { url, isCarrierPage, hasHtml: Boolean(html) } }
    );

    const textRaw = result.text.trim();
    const firstBrace = textRaw.indexOf("{");
    const lastBrace = textRaw.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      log.error(`[AI Scraper API] ❌ LLM output did not contain valid JSON bounds.`);
      return NextResponse.json(
        { success: false, reason: "PARSE_ERROR", message: "Failed to extract valid JSON structure from AI output." },
        { headers: corsHeaders }
      );
    }

    const cleanJsonStr = textRaw.slice(firstBrace, lastBrace + 1);
    let parsed: Record<string, unknown> = {};

    try {
      parsed = JSON.parse(cleanJsonStr);
    } catch (err) {
      log.error({ err }, `[AI Scraper API] ❌ JSON parse exception:`);
      return NextResponse.json(
        { success: false, reason: "PARSE_ERROR", message: "AI response string could not be parsed as valid JSON." },
        { headers: corsHeaders }
      );
    }

    const aiParsedData = {
      title: typeof parsed.title === "string" ? parsed.title.trim() : null,
      company: typeof parsed.company === "string" ? parsed.company.trim() : null,
      location: typeof parsed.location === "string" ? parsed.location.trim() : null,
      salary_range: typeof parsed.salary_range === "string" ? parsed.salary_range.trim() : null,
      salary_min: typeof parsed.salary_min === "number" ? parsed.salary_min : null,
      salary_max: typeof parsed.salary_max === "number" ? parsed.salary_max : null,
      employment_type: typeof parsed.employment_type === "string" ? parsed.employment_type.trim() : null,
      work_location: typeof parsed.work_location === "string" ? parsed.work_location.trim() : null,
      description: typeof parsed.description === "string" ? parsed.description.trim() : null,
      skills: Array.isArray(parsed.skills) ? parsed.skills.map((s: unknown) => String(s).trim()).filter(Boolean) : [],
      benefits: Array.isArray(parsed.benefits) ? parsed.benefits.map((b: unknown) => String(b).trim()).filter(Boolean) : [],
      contact_name: typeof parsed.contact_name === "string" ? parsed.contact_name.trim() : null,
      contact_email: typeof parsed.contact_email === "string" ? parsed.contact_email.trim() : null,
      contact_role: typeof parsed.contact_role === "string" ? parsed.contact_role.trim() : "Recruiter",
      department: typeof parsed.department === "string" ? parsed.department.trim() : null,
      vacancy: typeof parsed.vacancy === "string" ? parsed.vacancy.trim() : null,
      experience: typeof parsed.experience === "string" ? parsed.experience.trim() : null,
    };

    log.info(`[AI Scraper API] ✅ Deep scrape completed via "${providerName}"! (Title: "${aiParsedData.title || "N/A"}", Company: "${aiParsedData.company || "N/A"}")`);

    return NextResponse.json(
      {
        success: true,
        aiParsedData,
        provider: providerName,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    log.error({ err: error }, `[AI Scraper API] ❌ Internal Exception:`);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? cleanAiErrorMessage(error.message) : "Internal AI parse error",
      },
      { status: 500, headers: corsHeaders }
    );
  }
});
