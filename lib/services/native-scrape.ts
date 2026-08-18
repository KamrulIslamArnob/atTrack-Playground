/**
 * Native, key-free scraping fallback for when Firecrawl isn't configured.
 * Fetches the job posting's raw HTML server-side and reads the same
 * structured-data signals extension/content/content-script.js already reads
 * client-side — JSON-LD, Next.js's __NEXT_DATA__, then OpenGraph/microdata —
 * just against a static fetch instead of the live, JS-rendered DOM.
 *
 * Deliberately skips that file's platform-specific CSS selectors
 * (LinkedIn/Indeed/Greenhouse/Lever/...): those target content those sites
 * hydrate in via client JS after load, which a plain server-side fetch never
 * sees, so porting them here would mostly find nothing. What this does
 * recover is still returned in the same shape scrapeWithFirecrawl uses, so a
 * miss here just falls through to the existing LLM-over-Layer-1-text tier —
 * never a hard failure.
 */

import * as cheerio from "cheerio";
import { fetchWithLog } from "@/lib/log/fetch";
import { moduleLogger } from "@/lib/log";
import { assertPublicHttpUrl } from "@/lib/ai/providers";
import type { FirecrawlJobResult } from "./firecrawl";

const svcLog = moduleLogger("services.native-scrape");

/** The scrape target is a URL the user pasted — only the host goes to the
 *  log, matching lib/services/firecrawl.ts's own logging convention. */
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
        redirect: "manual", // treat a 3xx as a failed fetch rather than follow it — see assertPublicHttpUrl
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
    const data = extractJobPosting($);
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

function extractJobPosting($: cheerio.CheerioAPI): JobData {
  return extractJsonLd($) || extractNextData($) || extractGenericSemanticDom($);
}

/** Mirrors extension/content/content-script.js's extractJsonLd. */
function extractJsonLd($: cheerio.CheerioAPI): JobData | null {
  let found: JobData | null = null;

  $('script[type="application/ld+json"]').each((_, el) => {
    if (found) return;
    try {
      const json = JSON.parse($(el).text() || "{}");
      // Arbitrary third-party JSON-LD — same trust level lib/services/firecrawl.ts
      // already gives Firecrawl's response, so left loosely typed rather than
      // hand-modeling the schema.org JobPosting shape.
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

/** Mirrors extension/content/content-script.js's extractFrameworkState.
 *  Next.js embeds this as static JSON in the server-rendered HTML, so it's
 *  readable here without executing any client JS. */
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
      salary_range: job.salary || job.salaryRange || undefined,
      description: job.description || job.details || undefined,
      skills: [],
    };
  } catch {
    return null;
  }
}

/** Mirrors extension/content/content-script.js's extractGenericSemanticDom. */
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
  const mainEl = $('[itemprop="description"], main, article, [role="main"], #content, .content, .description').first();
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
