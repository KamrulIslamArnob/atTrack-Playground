/**
 * Firecrawl API Service for Advanced Cloud Scraping & Structured LLM Extraction
 * Docs: https://docs.firecrawl.dev
 */

import { fetchWithLog } from "@/lib/log/fetch";
import { moduleLogger } from "@/lib/log";
import { validatePublicUrl } from "@/lib/security/ssrf";

const svcLog = moduleLogger("services.firecrawl");

/** The scrape target is a URL the user pasted — it identifies the exact
 *  posting they are looking at, so only the host goes to the log. */
function targetHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "invalid";
  }
}

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
  const validation = validatePublicUrl(url);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error || "Invalid URL or target not allowed",
    };
  }

  const fcApiKey = apiKey || process.env.FIRECRAWL_API_KEY;
  const startTime = Date.now();

  const host = targetHost(url);
  svcLog.info({ event: "firecrawl.scrape.start", host });

  if (!fcApiKey) {
    svcLog.warn({ event: "firecrawl.scrape.skipped", host, reason: "no_api_key" });
    return {
      success: false,
      error: "Firecrawl API key not configured. Set FIRECRAWL_API_KEY environment variable or in Settings.",
    };
  }

  try {
    const response = await fetchWithLog("https://api.firecrawl.dev/v1/scrape", {
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
    }, { service: "firecrawl" });

    const elapsedMs = Date.now() - startTime;

    if (!response.ok) {
      const errText = await response.text();
      // errText echoes the provider's message, which can quote the scraped
      // URL — status and timing are enough to diagnose from a log.
      svcLog.error({ event: "firecrawl.scrape.failed", host, status: response.status, elapsedMs });
      return {
        success: false,
        error: `Firecrawl API Error (${response.status}): ${errText}`,
      };
    }

    const resData = await response.json();
    if (!resData.success || !resData.data) {
      svcLog.warn({ event: "firecrawl.scrape.unsuccessful", host, elapsedMs, hasData: Boolean(resData.data) });
      return {
        success: false,
        error: resData.error || "Firecrawl returned unsuccessful scrape response.",
      };
    }

    const jsonData = resData.data.json || {};
    const markdown = resData.data.markdown || "";

    svcLog.info({
      event: "firecrawl.scrape.ok",
      host,
      elapsedMs,
      markdownChars: markdown.length,
      fields: Object.keys(jsonData).length,
    });

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
    svcLog.error({ event: "firecrawl.scrape.error", host, elapsedMs, err: error });
    return {
      success: false,
      error: msg,
    };
  }
}
