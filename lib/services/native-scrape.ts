/**
 * Native, key-free scraping fallback for when Firecrawl isn't configured.
 * Deep carrier edition: handles BDT salary (Compensation BDT 40K), department,
 * vacancy, experience labeled fields common on BD career pages like eximusedu.
 *
 * Server-side fetch via cheerio — mirrors extension/content/content-script.js
 * deep extractors but statically. Falls through to AI layer if still thin.
 */

import * as cheerio from "cheerio";
import { fetchWithLog } from "@/lib/log/fetch";
import { moduleLogger } from "@/lib/log";
import { assertPublicHttpUrl } from "@/lib/ai/providers";
import type { FirecrawlJobResult } from "./firecrawl";

const svcLog = moduleLogger("services.native-scrape");

function targetHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "invalid";
  }
}

type JobData = NonNullable<FirecrawlJobResult["data"]>;

export async function scrapeNative(url: string): Promise<FirecrawlJobResult> {
  const startTime = Date.now();
  const host = targetHost(url);
  svcLog.info({ event: "native.scrape.start", host });

  try {
    assertPublicHttpUrl(url);

    const response = await fetchWithLog(
      url,
      {
        headers: { "user-agent": "Mozilla/5.0 (compatible; atTrack/1.0)" },
        redirect: "manual",
        signal: AbortSignal.timeout(15_000),
      },
      { service: "native-scrape" }
    );

    if (!response.ok) {
      svcLog.warn({ event: "native.scrape.failed", host, status: response.status });
      return { success: false, error: `Fetch failed: HTTP ${response.status}` };
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const data = extractJobPosting($, html);
    const elapsedMs = Date.now() - startTime;

    if (!data.title && !data.description) {
      svcLog.warn({ event: "native.scrape.empty", host, elapsedMs });
      return { success: false, error: "No structured job data found in page." };
    }

    svcLog.info({ event: "native.scrape.ok", host, elapsedMs, hasTitle: Boolean(data.title) });
    return { success: true, data };
  } catch (error) {
    const elapsedMs = Date.now() - startTime;
    const msg = error instanceof Error ? error.message : "Native scrape error";
    svcLog.error({ event: "native.scrape.error", host, elapsedMs, err: error });
    return { success: false, error: msg };
  }
}

function extractJobPosting($: cheerio.CheerioAPI, rawHtml?: string): JobData {
  // Try structured sources first
  const jsonLd = extractJsonLd($);
  const nextData = extractNextData($);
  const generic = extractGenericSemanticDom($);

  // Deep carrier text scan (BDT salary, dept, vacancy) — works even when JSON-LD generic are thin
  const bodyText = $("body").text() || "";
  const carrier = extractCarrierFields($, bodyText, rawHtml || "");

  // Merge with priority: JSON-LD > Next > carrier > generic, but carrier fills gaps for salary/dept/vacancy
  const merged: JobData = {
    title: jsonLd?.title || nextData?.title || carrier.title || generic.title || undefined,
    company: jsonLd?.company || nextData?.company || carrier.company || generic.company || undefined,
    location: jsonLd?.location || nextData?.location || carrier.location || generic.location || undefined,
    salary_range: jsonLd?.salary_range || nextData?.salary_range || carrier.salary_range || generic.salary_range || undefined,
    employment_type: jsonLd?.employment_type || nextData?.employment_type || carrier.employment_type || generic.employment_type || undefined,
    work_location: carrier.work_location || generic.work_location || undefined,
    description: jsonLd?.description || nextData?.description || carrier.description || generic.description || undefined,
    skills: jsonLd?.skills?.length ? jsonLd.skills : nextData?.skills?.length ? nextData.skills : carrier.skills?.length ? carrier.skills : generic.skills || [],
    // Extra carrier fields bubbled via description prefix (AI will parse), but keep here for fallback
  };

  // If carrier found strong salary/dept but merged already has title, ensure we preserve carrier salary even when JSON-LD generic missed it
  if (!merged.salary_range && carrier.salary_range) merged.salary_range = carrier.salary_range;
  if (carrier.description && (!merged.description || merged.description.length < 500)) {
    // Prefer carrier-rich description if generic was thin
    merged.description = carrier.description;
  }

  return merged;
}

function extractCarrierFields($: cheerio.CheerioAPI, bodyText: string, rawHtml: string): Partial<JobData> & { work_location?: string } {
  const text = bodyText.slice(0, 20000);
  const lower = text.toLowerCase();

  // Salary — BDT-aware deep
  let salary_range: string | undefined;
  const salaryPatterns = [
    /(?:Compensation|Salary|Pay|Package|Remuneration)\s*[:\-]?\s*(?:BDT|Tk\.?|USD|EUR|GBP|INR|₹|\$|£|€)?\s*[\d,]+\s*(?:[\-–—to]+\s*[\d,]+\s*)?(?:\s*(?:K|k|thousand|lakh|per\s*month|\/month|\/mo|\/year|\/yr|BDT|Taka))?/i,
    /(?:BDT|Tk\.?|Taka)\s*[\d,]+\s*(?:[\-–—to]+\s*[\d,]+\s*)?(?:\s*(?:K|k|thousand|lakh|per\s*month|\/month|\/mo))?/i,
    /[\d,]+\s*(?:BDT|Tk\.?|Taka)\s*(?:per\s*month|\/month|\/mo)?/i,
    /Salary\s*[:\-]?\s*Negotiable/i,
  ];
  for (const pat of salaryPatterns) {
    const m = text.match(pat);
    if (m && m[0].length > 8) { salary_range = m[0].replace(/\s+/g, " ").trim().slice(0, 80); break; }
  }

  // Department / vacancy / experience via labeled fields common on eximusedu & BD boards
  const dept = extractLabeledField(text, ["Department", "Dept", "Functional Area", "Category", "Division", "Team"]);
  const vacancy = extractLabeledField(text, ["Vacancy", "Vacancies", "No. of Vacancies", "Positions", "Openings"]);
  const experience = extractLabeledField(text, ["Experience", "Exp", "Experience Required", "Years of Experience", "Employment Status", "Education"]);
  const location = extractLabeledField(text, ["Job Location", "Location", "Workplace", "Office Location"]);
  const employment_type = extractLabeledField(text, ["Employment Status", "Job Type", "Employment Type"]);
  const work_location = normalizeWorkLocation(employment_type + " " + location + " " + lower);

  // Description — try to find main content area
  let description: string | undefined;
  const selectors = [".job-description", ".career-details", ".job-content", "[itemprop='description']", "main", "article", "#content", ".content"];
  for (const sel of selectors) {
    const el = $(sel).first();
    if (el.length) {
      const txt = el.text().trim();
      if (txt.length > 300) { description = txt.slice(0, 20000); break; }
    }
  }
  if (!description) {
    $("script, style, nav, footer, header, svg, iframe, noscript").remove();
    description = $("body").text().trim().slice(0, 20000);
  }

  // Title fallback — h1
  let title: string | undefined;
  const h1 = $("h1").first().text().trim() || $("h2").first().text().trim();
  if (h1 && h1.length > 5 && h1.length < 120) title = h1;

  // Company fallback — try eximusedu detection
  let company: string | undefined;
  if (rawHtml.toLowerCase().includes("eximusedu") || text.toLowerCase().includes("eximusedu")) company = "EximusEdu";
  else company = $('meta[property="og:site_name"]').attr("content") || undefined;

  return {
    title,
    company,
    location: location || undefined,
    salary_range,
    employment_type: employment_type ? normalizeEmploymentType(employment_type) : undefined,
    work_location,
    description,
    skills: [],
  };
}

function extractLabeledField(text: string, labels: string[]): string {
  for (const label of labels) {
    const esc = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?:${esc})\\s*[:\\-]?\\s*([^\\n\\r]{2,80}?)(?:\\n|\\r|$|\\s{2,}|;|,\\s*[A-Z][a-z]+\\s*:)`, "i");
    const m = text.match(re);
    if (m && m[1]) {
      const val = m[1].trim().replace(/\s+/g, " ");
      if (val.length >= 2 && val.length <= 80) return val;
    }
  }
  return "";
}

function normalizeEmploymentType(raw: string): string {
  if (!raw) return "Full-time";
  const s = String(raw).toUpperCase();
  if (s.includes("FULL") || s.includes("PERMANENT")) return "Full-time";
  if (s.includes("PART")) return "Part-time";
  if (s.includes("CONTRACT") || s.includes("FREELANCE") || s.includes("TEMPORARY")) return "Contract";
  if (s.includes("INTERN")) return "Internship";
  return "Full-time";
}

function normalizeWorkLocation(raw: string): string {
  if (!raw) return "On-site";
  const s = String(raw).toUpperCase();
  if (s.includes("REMOTE") || s.includes("WORK FROM HOME") || s.includes("WFH") || s.includes("TELECOMMUTE")) return "Remote";
  if (s.includes("HYBRID")) return "Hybrid";
  return "On-site";
}

/** Mirrors extension/content/content-script.js's extractJsonLd. */
function extractJsonLd($: cheerio.CheerioAPI): JobData | null {
  let found: JobData | null = null;

  $('script[type="application/ld+json"]').each((_, el) => {
    if (found) return;
    try {
      const json = JSON.parse($(el).text() || "{}");
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const items: any[] = Array.isArray(json) ? json : json["@graph"] ? json["@graph"] : [json];
      const job = items.find(
        (item: any) => item && (item["@type"] === "JobPosting" || String(item["@type"] || "").includes("JobPosting"))
      );
      /* eslint-enable @typescript-eslint/no-explicit-any */
      if (!job) return;

      let company = "";
      if (job.hiringOrganization && typeof job.hiringOrganization === "object") {
        company = job.hiringOrganization.name || "";
      } else if (typeof job.hiringOrganization === "string") {
        company = job.hiringOrganization;
      }

      let location = "";
      if (job.jobLocation) {
        const locs = Array.isArray(job.jobLocation) ? job.jobLocation : [job.jobLocation];
        location = locs
          .map((l: Record<string, unknown>) => {
            if (l?.address) {
              const a = l.address as Record<string, unknown>;
              return [a.addressLocality, a.addressRegion, a.addressCountry].filter(Boolean).join(", ");
            }
            return l?.name || "";
          })
          .filter(Boolean)
          .join(" | ");
      }

      let salary_range = "";
      if (job.baseSalary?.value) {
        const s = job.baseSalary;
        const v = s.value;
        const amount = typeof v === "object" ? `${v.minValue || ""}-${v.maxValue || v.value || ""}` : v;
        salary_range = `${s.currency || "$"} ${amount}`.trim();
      }

      found = {
        title: job.title || undefined,
        company: company || undefined,
        location: location || undefined,
        salary_range: salary_range || undefined,
        employment_type: job.employmentType || undefined,
        description: job.description || undefined,
        skills: [],
      };
    } catch {
      // malformed JSON-LD on this script tag — try the next one
    }
  });

  return found;
}

/** Mirrors extension/content/content-script.js's extractFrameworkState. */
function extractNextData($: cheerio.CheerioAPI): JobData | null {
  try {
    const raw = $("#__NEXT_DATA__").text();
    if (!raw) return null;
    const nextData = JSON.parse(raw);
    const pageProps = nextData?.props?.pageProps;
    const job =
      pageProps?.job || pageProps?.posting || pageProps?.jobDetails || pageProps?.initialJob || pageProps?.position;
    if (!job || typeof job !== "object") return null;

    return {
      title: job.title || job.name || job.positionTitle || undefined,
      company: job.company?.name || job.companyName || (typeof job.company === "string" ? job.company : undefined),
      location: job.location || job.locationName || undefined,
      salary_range: job.salary || job.salaryRange || job.compensation || undefined,
      description: job.description || job.details || undefined,
      skills: [],
    };
  } catch {
    return null;
  }
}

/** Generic + carrier-aware fallback. */
function extractGenericSemanticDom($: cheerio.CheerioAPI): JobData {
  const title =
    $('[itemprop="title"]').first().text().trim() ||
    $("h1").first().text().trim() ||
    $('meta[property="og:title"]').attr("content") ||
    "";

  const company =
    $('[itemprop="hiringOrganization"]').first().text().trim() ||
    $('meta[property="og:site_name"]').attr("content") ||
    "";

  const location =
    $('[itemprop="jobLocation"]').first().text().trim() ||
    $('[class*="location"], [id*="location"]').first().text().trim();

  let description = "";
  const mainEl = $('[itemprop="description"], main, article, [role="main"], #content, .content, .description, .job-desc').first();
  if (mainEl.length) {
    description = mainEl.text().trim();
  } else {
    $("script, style, nav, footer, header, svg, iframe, noscript").remove();
    description = $("body").text().trim();
  }

  return {
    title: title || undefined,
    company: company || undefined,
    location: location || undefined,
    description: description ? description.slice(0, 20_000) : undefined,
    skills: [],
  };
}
