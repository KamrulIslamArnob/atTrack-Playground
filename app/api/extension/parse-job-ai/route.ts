import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { resolveProviderChain, generateText } from "@/lib/ai/providers";
import { scrapeWithFirecrawl } from "@/lib/services/firecrawl";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(req: Request) {
  try {
    const { userId } = await getUser();

    const body = await req.json();
    const url = typeof body.url === "string" ? body.url.trim() : "";
    const pageText = typeof body.pageText === "string" ? body.pageText.trim() : "";
    const layer1Data = typeof body.layer1Data === "object" && body.layer1Data ? body.layer1Data : {};
    const firecrawlApiKey = typeof body.firecrawlApiKey === "string" ? body.firecrawlApiKey.trim() : process.env.FIRECRAWL_API_KEY;

    if (!url && !pageText && !layer1Data.title) {
      return NextResponse.json(
        { error: "URL, page content text, or Layer 1 data is required for parsing." },
        { status: 400, headers: corsHeaders }
      );
    }

    // --- 1. Try Firecrawl API First if Key is Configured ---
    if (url && firecrawlApiKey) {
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
      console.warn(`[AI Scraper API] Firecrawl scrape failed or unconfigured. Falling back to local LLM provider chain...`);
    }

    // --- 2. Fallback to Local LLM Provider Chain (Gemini / OpenRouter) ---
    const chain = await resolveProviderChain(userId, "text");
    if (!chain || chain.length === 0) {
      console.warn(`[AI Scraper API] ⚠️ No active LLM provider chain found for user. Layer 1 offline DOM data will be used.`);
      return NextResponse.json(
        {
          success: false,
          reason: "NO_AI_PROVIDER",
          message: "No AI provider or Firecrawl key configured in atTrack. Using Layer 1 offline DOM extraction.",
        },
        { headers: corsHeaders }
      );
    }

    const providerName = chain[0].name || chain[0].provider_type;
    console.log(`[AI Scraper API] 🤖 Running LLM Job Parser via provider: "${providerName}" (Model: "${chain[0].model}")`);

    const prompt = `You are an expert technical recruiter and AI job parser.
Analyze this job posting content and extract precise, structured job information.

URL: ${url}

Page Text Content:
${pageText.slice(0, 6000)}

Layer 1 Offline Extracted Reference:
${JSON.stringify(layer1Data)}

Return ONLY a valid JSON object in this exact format:
{
  "title": "Job Title",
  "company": "Company Name",
  "location": "City, State/Country or Remote",
  "salary_range": "$120,000 - $150,000",
  "salary_min": 120000,
  "salary_max": 150000,
  "employment_type": "Full-time",
  "work_location": "Remote",
  "description": "Structured job summary and responsibilities...",
  "skills": ["React", "TypeScript", "Node.js"],
  "benefits": ["Health Insurance", "401k Match"],
  "contact_name": "Recruiter/Hiring Manager Name if mentioned, else null",
  "contact_email": "Recruiter email if mentioned, else null",
  "contact_role": "Recruiter"
}
IMPORTANT: Output ONLY the raw JSON object, no markdown commentary.`;

    const result = await generateText(
      chain,
      { userPrompt: prompt },
      { userId, action: "extension_ai_parse_job", metadata: { url } }
    );

    const textRaw = result.text.trim();
    const firstBrace = textRaw.indexOf("{");
    const lastBrace = textRaw.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      console.error(`[AI Scraper API] ❌ LLM output did not contain valid JSON bounds.`);
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
      console.error(`[AI Scraper API] ❌ JSON parse exception:`, err);
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
    };

    console.log(`[AI Scraper API] ✅ LLM Parsing Completed via "${providerName}"! (Title: "${aiParsedData.title || "N/A"}", Company: "${aiParsedData.company || "N/A"}")`);

    return NextResponse.json(
      {
        success: true,
        aiParsedData,
        provider: providerName,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error(`[AI Scraper API] ❌ Internal Exception:`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal AI parse error",
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
