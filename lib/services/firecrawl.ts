/**
 * Firecrawl API Service for Advanced Cloud Scraping & Structured LLM Extraction
 * Docs: https://docs.firecrawl.dev
 */

export interface FirecrawlJobResult {
  success: boolean;
  data?: {
    title?: string;
    company?: string;
    location?: string;
    salary_range?: string;
    employment_type?: string;
    work_location?: string;
    description?: string;
    skills?: string[];
    contact_name?: string;
    contact_email?: string;
    contact_role?: string;
    markdown?: string;
  };
  error?: string;
}

export async function scrapeWithFirecrawl(
  url: string,
  apiKey?: string
): Promise<FirecrawlJobResult> {
  const fcApiKey = apiKey || process.env.FIRECRAWL_API_KEY;
  const startTime = Date.now();

  console.log(`\n=================================================`);
  console.log(`[Firecrawl Parser] 🚀 Initiating Cloud Scrape for URL: ${url}`);
  console.log(`=================================================`);

  if (!fcApiKey) {
    console.warn(`[Firecrawl Parser] ⚠️ FIRECRAWL_API_KEY is missing. Skipping Firecrawl.`);
    return {
      success: false,
      error: "Firecrawl API key not configured. Set FIRECRAWL_API_KEY environment variable or in Settings.",
    };
  }

  try {
    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${fcApiKey}`,
      },
      body: JSON.stringify({
        url,
        formats: ["markdown", "json"],
        jsonOptions: {
          prompt:
            "Extract complete job posting details: job title, company name, location, salary range, employment type (Full-time, Part-time, Contract, Internship), work location (Remote, Hybrid, On-site), full job description, required technical skills array, and recruiter contact info if mentioned.",
          schema: {
            type: "object",
            properties: {
              title: { type: "string" },
              company: { type: "string" },
              location: { type: "string" },
              salary_range: { type: "string" },
              employment_type: { type: "string" },
              work_location: { type: "string" },
              description: { type: "string" },
              skills: { type: "array", items: { type: "string" } },
              contact_name: { type: "string" },
              contact_email: { type: "string" },
              contact_role: { type: "string" },
            },
          },
        },
      }),
    });

    const elapsedMs = Date.now() - startTime;

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[Firecrawl Parser] ❌ HTTP ${response.status} Error after ${elapsedMs}ms:`, errText);
      return {
        success: false,
        error: `Firecrawl API Error (${response.status}): ${errText}`,
      };
    }

    const resData = await response.json();
    if (!resData.success || !resData.data) {
      console.warn(`[Firecrawl Parser] ⚠️ Unsuccessful response payload after ${elapsedMs}ms:`, resData.error || "No data");
      return {
        success: false,
        error: resData.error || "Firecrawl returned unsuccessful scrape response.",
      };
    }

    const jsonData = resData.data.json || {};
    const markdown = resData.data.markdown || "";

    console.log(`[Firecrawl Parser] ✅ SUCCESS in ${elapsedMs}ms!`);
    console.log(`  • Title: "${jsonData.title || "N/A"}"`);
    console.log(`  • Company: "${jsonData.company || "N/A"}"`);
    console.log(`  • Location: "${jsonData.location || "N/A"}"`);
    console.log(`  • Salary: "${jsonData.salary_range || "N/A"}"`);
    console.log(`  • Skills (${jsonData.skills?.length || 0}):`, jsonData.skills || []);
    console.log(`=================================================\n`);

    return {
      success: true,
      data: {
        title: jsonData.title || null,
        company: jsonData.company || null,
        location: jsonData.location || null,
        salary_range: jsonData.salary_range || null,
        employment_type: jsonData.employment_type || null,
        work_location: jsonData.work_location || null,
        description: jsonData.description || markdown || null,
        skills: Array.isArray(jsonData.skills) ? jsonData.skills : [],
        contact_name: jsonData.contact_name || null,
        contact_email: jsonData.contact_email || null,
        contact_role: jsonData.contact_role || "Recruiter",
        markdown,
      },
    };
  } catch (error) {
    const elapsedMs = Date.now() - startTime;
    const msg = error instanceof Error ? error.message : "Network error";
    console.error(`[Firecrawl Parser] ❌ Request failed after ${elapsedMs}ms:`, msg);
    return {
      success: false,
      error: msg,
    };
  }
}
