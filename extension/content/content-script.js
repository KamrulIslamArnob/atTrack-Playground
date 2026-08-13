// atTrack Universal Job Scraper - Layer 1 Engine (DOM, DevTools, Framework & Platform Extractors)

(() => {
  function extractJobData() {
    try {
      const url = window.location.href;
      const hostname = window.location.hostname.toLowerCase();

      let title = "";
      let company = "";
      let location = "";
      let salaryRange = "";
      let employmentType = "";
      let workLocation = "";
      let description = "";
      let experience = "";
      let department = "";
      let vacancy = "";
      let skills = [];
      let extractionMethod = "DOM Heuristic";

      // --- 1. JSON-LD Schema Extractor ---
      const jsonLdData = extractJsonLd();
      if (jsonLdData) {
        title = jsonLdData.title || title;
        company = jsonLdData.company || company;
        location = jsonLdData.location || location;
        salaryRange = jsonLdData.salary || salaryRange;
        employmentType = jsonLdData.employmentType || employmentType;
        description = jsonLdData.description || description;
        if (title && company) extractionMethod = "JSON-LD Schema";
      }

      // --- 2. Hydrated Framework State Extractor ---
      if (!title || !company || !description) {
        const frameworkData = extractFrameworkState();
        if (frameworkData) {
          title = title || frameworkData.title;
          company = company || frameworkData.company;
          location = location || frameworkData.location;
          salaryRange = salaryRange || frameworkData.salary;
          description = description || frameworkData.description;
          if (title && company) extractionMethod = "Framework State (__NEXT_DATA__)";
        }
      }

      // --- 3. Platform-Specific Extractors ---
      const platformData = extractPlatformSpecific(hostname, url);
      if (platformData) {
        title = title || platformData.title;
        company = company || platformData.company;
        location = location || platformData.location;
        salaryRange = salaryRange || platformData.salary;
        description = description || platformData.description;
        if (!extractionMethod || extractionMethod === "DOM Heuristic") {
          extractionMethod = platformData.platform || "Platform Extractor";
        }
      }

      // --- 4. Generic Microdata & OpenGraph Semantic DOM Extractor ---
      if (!title || !company || !description) {
        const generic = extractGenericSemanticDom();
        title = title || generic.title;
        company = company || generic.company;
        location = location || generic.location;
        description = description || generic.description;
      }

      // Clean up description HTML entities & raw CSS attributes
      description = decodeHtmlAndClean(description);

      // --- 5. Heuristic fallback for Title & Company from document.title ---
      if (!title || !company) {
        const pageTitle = document.title || "";
        if (pageTitle.includes(" at ")) {
          const parts = pageTitle.split(" at ");
          title = title || parts[0].trim();
          company = company || parts[1].split("|")[0].split("-")[0].trim();
        } else if (pageTitle.includes(" - ")) {
          const parts = pageTitle.split(" - ");
          title = title || parts[0].trim();
          company = company || parts[1].trim();
        } else if (pageTitle.includes(" | ")) {
          const parts = pageTitle.split(" | ");
          title = title || parts[0].trim();
          company = company || parts[1].trim();
        } else if (pageTitle.includes(" hiring ")) {
          const parts = pageTitle.split(" hiring ");
          company = company || parts[0].trim();
          title = title || parts[1].split("|")[0].split("-")[0].trim();
        }
      }

      // Fallback for company from OpenGraph site_name or hostname
      if (!company) {
        const ogSiteName = document.querySelector('meta[property="og:site_name"]')?.getAttribute("content");
        if (ogSiteName) {
          company = ogSiteName;
        } else {
          const cleanHost = hostname.replace(/^www\./, "").split(".")[0];
          if (cleanHost && cleanHost !== "localhost") {
            company = cleanHost.charAt(0).toUpperCase() + cleanHost.slice(1);
          }
        }
      }

      // Fallback for title from main H1
      if (!title) {
        const h1 = document.querySelector("h1");
        if (h1 && h1.textContent) title = h1.textContent.trim();
      }

      // --- 6. Multi-Currency & Monthly Salary Extractor ---
      const pageFullText = (document.body.innerText || description || "").slice(0, 10000);
      if (!salaryRange) {
        salaryRange = extractSalaryFromText(pageFullText);
      }

      // --- 7. Additional Job Meta Fields (Experience, Department, Vacancies) ---
      experience = extractMetaField(pageFullText, ["Experience Required", "Experience", "Min Experience", "Years of Experience"]);
      department = extractMetaField(pageFullText, ["Department", "Function", "Team", "Category"]);
      vacancy = extractMetaField(pageFullText, ["Vacancy", "Vacancies", "Openings", "Positions"]);

      // --- 8. Work Location Mode Detection ---
      const fullTextLower = (title + " " + location + " " + description).toLowerCase();
      workLocation = normalizeWorkLocation(workLocation || location || fullTextLower);

      // --- 9. Employment Type Detection & Normalization ---
      employmentType = normalizeEmploymentType(employmentType || fullTextLower);

      // --- 10. Technical Skills Dictionary ---
      skills = extractSkillKeywords(description + " " + title);

      const cleanPageText = (title + "\n" + company + "\n" + location + "\n\n" + description).slice(0, 7000);

      return {
        title: cleanText(title) || "Job Position",
        company: cleanText(company) || "Company Name",
        location: cleanText(location),
        salary_range: cleanText(salaryRange),
        employment_type: employmentType,
        work_location: workLocation,
        application_url: url,
        source: getDomainSource(hostname),
        description: cleanText(description).slice(0, 8000),
        experience: cleanText(experience),
        department: cleanText(department),
        vacancy: cleanText(vacancy),
        skills: skills.slice(0, 15),
        extraction_method: extractionMethod,
        clean_page_text: cleanPageText,
      };
    } catch (err) {
      console.warn("[atTrack Content Script] Job extraction warning:", err);
      return {
        title: document.title || "Job Position",
        company: window.location.hostname.replace("www.", ""),
        application_url: window.location.href,
        description: (document.body.innerText || "").slice(0, 5000),
        extraction_method: "Fallback DOM",
        clean_page_text: (document.body.innerText || "").slice(0, 5000),
      };
    }
  }

  function getText(selector) {
    try {
      const el = document.querySelector(selector);
      return el ? el.textContent || "" : "";
    } catch {
      return "";
    }
  }

  // HTML Entity decoder and CSS / style stripper
  function decodeHtmlAndClean(str) {
    if (!str) return "";
    let text = str;
    try {
      const textarea = document.createElement("textarea");
      textarea.innerHTML = str;
      text = textarea.value || textarea.textContent || str;
    } catch {
      // fallback
    }

    // Remove CSS inline style declarations and raw attribute artifacts
    text = text.replace(/<[^>]*>/g, " ");
    text = text.replace(/space;pre;white-space:[^;]+;/gi, " ");
    text = text.replace(/(?:dir|style|class|id)=&quot;[^&]*&quot;/gi, " ");
    text = text.replace(/(?:dir|style|class|id)="[^"]*"/gi, " ");
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&lt;/g, "<");
    text = text.replace(/&gt;/g, ">");
    text = text.replace(/&amp;/g, "&");
    text = text.replace(/&#39;/g, "'");

    return text.replace(/\s+/g, " ").trim();
  }

  // Normalize Employment Type string to standard options ("Full-time" | "Part-time" | "Contract" | "Internship")
  function normalizeEmploymentType(raw) {
    if (!raw) return "Full-time";
    const str = String(raw).toUpperCase();
    if (str.includes("FULL") || str.includes("PERMANENT")) return "Full-time";
    if (str.includes("PART")) return "Part-time";
    if (str.includes("CONTRACT") || str.includes("FREELANCE") || str.includes("TEMPORARY")) return "Contract";
    if (str.includes("INTERN")) return "Internship";
    return "Full-time";
  }

  // Normalize Work Mode string ("Remote" | "Hybrid" | "On-site")
  function normalizeWorkLocation(raw) {
    if (!raw) return "On-site";
    const str = String(raw).toUpperCase();
    if (str.includes("REMOTE") || str.includes("WORK FROM HOME") || str.includes("TELECOMMUTE")) return "Remote";
    if (str.includes("HYBRID")) return "Hybrid";
    return "On-site";
  }

  // Multi-Currency & Monthly Salary Extractor Regex
  function extractSalaryFromText(text) {
    if (!text) return "";
    const patterns = [
      /(?:Monthly\s+Salary|Salary|Compensation|Pay|Package)\s*[:\-]?\s*([A-Z]{3}|\$|₹|£|€|BDT|USD)?\s*([\d,]+(?:\s*[\-–—to]\s*[\d,]+)?(?:\s*(?:k|thousand|lakh|per\s*month|\/month|\/mo|\/year|\/yr))?)/i,
      /(?:BDT|USD|EUR|GBP|INR|₹|\$|£|€)\s*[\d,]+\s*(?:[\-–—to]\s*[\d,]+)?(?:\s*(?:k|thousand|lakh|per\s*month|\/month|\/mo|\/year|\/yr))?/i,
    ];

    for (const pat of patterns) {
      const match = text.match(pat);
      if (match) {
        return match[0].replace(/\s+/g, " ").trim();
      }
    }
    return "";
  }

  // Generic metadata line finder (Experience Required: ..., Department: ..., Vacancy: ...)
  function extractMetaField(text, keywords) {
    for (const kw of keywords) {
      const regex = new RegExp(`(?:${kw})\\s*[:\\-]?\\s*([^\\n\\r;,]{2,40})`, "i");
      const match = text.match(regex);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return "";
  }

  // Layer 1.1: JSON-LD Extractor
  function extractJsonLd() {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      try {
        const json = JSON.parse(script.textContent || "{}");
        const items = Array.isArray(json) ? json : json["@graph"] ? json["@graph"] : [json];
        const job = items.find((item) => item && (item["@type"] === "JobPosting" || item["@type"]?.includes("JobPosting")));
        if (job) {
          const title = job.title || "";
          let company = "";
          if (typeof job.hiringOrganization === "object") {
            company = job.hiringOrganization.name || "";
          } else if (typeof job.hiringOrganization === "string") {
            company = job.hiringOrganization;
          }

          let location = "";
          if (job.jobLocation) {
            const locs = Array.isArray(job.jobLocation) ? job.jobLocation : [job.jobLocation];
            location = locs
              .map((l) => {
                if (l.address) {
                  const a = l.address;
                  return [a.addressLocality, a.addressRegion, a.addressCountry].filter(Boolean).join(", ");
                }
                return l.name || "";
              })
              .filter(Boolean)
              .join(" | ");
          }

          let salary = "";
          if (job.baseSalary) {
            const s = job.baseSalary;
            if (s.value) {
              const val = typeof s.value === "object" ? `${s.value.minValue || ""}-${s.value.maxValue || s.value.value || ""}` : s.value;
              salary = `${s.currency || "$"} ${val} ${s.value.unitText ? "/" + s.value.unitText : ""}`.trim();
            }
          }

          return {
            title,
            company,
            location,
            salary,
            employmentType: job.employmentType || "",
            description: job.description || "",
          };
        }
      } catch {
        // ignore
      }
    }
    return null;
  }

  // Layer 1.2: Framework Hydration State Extractor
  function extractFrameworkState() {
    try {
      const nextDataEl = document.getElementById("__NEXT_DATA__");
      if (nextDataEl && nextDataEl.textContent) {
        const nextData = JSON.parse(nextDataEl.textContent);
        const pageProps = nextData?.props?.pageProps;
        if (pageProps) {
          const jobObj = pageProps.job || pageProps.posting || pageProps.jobDetails || pageProps.initialJob || pageProps.position;
          if (jobObj && typeof jobObj === "object") {
            return {
              title: jobObj.title || jobObj.name || jobObj.positionTitle || "",
              company: jobObj.company?.name || jobObj.companyName || jobObj.company || "",
              location: jobObj.location || jobObj.locationName || "",
              salary: jobObj.salary || jobObj.salaryRange || "",
              description: jobObj.description || jobObj.details || "",
            };
          }
        }
      }
    } catch {
      // ignore
    }
    return null;
  }

  // Layer 1.3: Platform Extractors (including OnnoRokom Projukti / m2s-job-application & Freshteam)
  function extractPlatformSpecific(hostname, url) {
    if (hostname.includes("onnorokomprojukti.com") || url.includes("m2s-job-application")) {
      return {
        platform: "OnnoRokom Projukti",
        title: getText(".job-title, .career-title, h1, h2"),
        company: "OnnoRokom Projukti",
        location: getText(".job-location, .location") || "Dhaka, Bangladesh",
        description: getText(".job-description, .career-details, main, body"),
      };
    }
    if (hostname.includes("freshteam.com")) {
      return {
        platform: "Freshteam",
        title: getText(".job-title, h1, h2"),
        company: getText(".company-name, .logo img[alt]") || document.title.split("-")[0]?.trim(),
        location: getText(".location, .job-location"),
        description: getText(".job-description, .description-container, body"),
      };
    }
    if (hostname.includes("linkedin.com")) {
      return {
        platform: "LinkedIn",
        title: getText(".job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title, h1"),
        company: getText(".job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name"),
        location: getText(".job-details-jobs-unified-top-card__bullet, .jobs-unified-top-card__bullet"),
        description: getText("#job-details, .jobs-description__content, .jobs-box__html-content"),
      };
    }
    if (hostname.includes("indeed.com")) {
      return {
        platform: "Indeed",
        title: getText(".jobsearch-JobInfoHeader-title, h1"),
        company: getText('[data-testid="inlineHeader-companyName"], .jobsearch-InlineCompanyHeader-companyHeader'),
        location: getText('[data-testid="inlineHeader-companyLocation"]'),
        description: getText("#jobDescriptionText"),
      };
    }
    if (hostname.includes("greenhouse.io")) {
      return {
        platform: "Greenhouse",
        title: getText(".app-title, h1.heading"),
        company: document.querySelector(".company-name, .logo img[alt]")?.getAttribute("alt") || getText(".company-name"),
        location: getText(".location"),
        description: getText("#content, #main"),
      };
    }
    if (hostname.includes("lever.co")) {
      return {
        platform: "Lever",
        title: getText(".posting-header h2, h2"),
        company: document.querySelector(".main-header logo img[alt]")?.getAttribute("alt") || "",
        location: getText(".posting-categories .location"),
        description: getText(".content-wrapper, .section.page-centered"),
      };
    }
    return null;
  }

  // Layer 1.4: Generic Microdata & OpenGraph Extractor
  function extractGenericSemanticDom() {
    const title = getText('[itemprop="title"]') || getText("h1") || document.querySelector('meta[property="og:title"]')?.getAttribute("content") || "";
    const company = getText('[itemprop="hiringOrganization"]') || document.querySelector('meta[property="og:site_name"]')?.getAttribute("content") || "";
    const location = getText('[itemprop="jobLocation"]') || getText('[class*="location"], [id*="location"]');

    let description = "";
    const mainEl = document.querySelector('[itemprop="description"], main, article, [role="main"], #content, .content, .description');
    if (mainEl) {
      description = mainEl.textContent || "";
    } else {
      const clone = document.body.cloneNode(true);
      const toRemove = clone.querySelectorAll("script, style, nav, footer, header, svg, iframe, noscript");
      toRemove.forEach((el) => el.remove());
      description = clone.textContent || "";
    }

    return { title, company, location, description };
  }

  // Technical Skills Dictionary (60+ Skills & Tools)
  function extractSkillKeywords(text) {
    if (!text) return [];
    const techSkills = [
      "React", "Next.js", "TypeScript", "JavaScript", "Node.js", "Python", "Java", "C++", "C#", "Go", "Rust",
      "Ruby", "PHP", "Swift", "Kotlin", "HTML", "CSS", "Tailwind", "PostgreSQL", "MySQL", "MongoDB", "Redis",
      "GraphQL", "REST API", "Docker", "Kubernetes", "AWS", "GCP", "Azure", "Git", "CI/CD", "Linux",
      "Spring Boot", "Django", "FastAPI", "Express", "Vite", "Redux", "Zustand", "Jest", "Cypress", "Playwright",
      "SQL", "NoSQL", "Kafka", "Elasticsearch", "Terraform", "Microservices", "System Design", "Agile", "Scrum",
      "Jira", "Linear", "ClickUp", "Trello", "G Suite", "Microsoft Office", "BBA", "CSE", "Project Management"
    ];

    const found = [];
    const textLower = text.toLowerCase();
    for (const skill of techSkills) {
      const regex = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (regex.test(textLower)) {
        found.push(skill);
      }
    }
    return found;
  }

  function cleanText(str) {
    if (!str) return "";
    return str.replace(/\s+/g, " ").trim();
  }

  function getDomainSource(hostname) {
    if (hostname.includes("onnorokomprojukti.com")) return "OnnoRokom Projukti";
    if (hostname.includes("freshteam.com")) return "Freshteam";
    if (hostname.includes("linkedin.com")) return "LinkedIn";
    if (hostname.includes("indeed.com")) return "Indeed";
    if (hostname.includes("greenhouse.io")) return "Greenhouse";
    if (hostname.includes("lever.co")) return "Lever";
    if (hostname.includes("glassdoor.com")) return "Glassdoor";
    if (hostname.includes("workday.com")) return "Workday";
    if (hostname.includes("ashbyhq.com")) return "Ashby";
    if (hostname.includes("smartrecruiters.com")) return "SmartRecruiters";
    return hostname.replace("www.", "");
  }

  if (!window.__atTrackContentScriptLoaded) {
    window.__atTrackContentScriptLoaded = true;
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === "EXTRACT_JOB_DETAILS") {
        try {
          const details = extractJobData();
          sendResponse({ success: true, data: details });
        } catch (err) {
          sendResponse({ success: false, error: err.message || String(err) });
        }
      }
      return true;
    });
  }

  window.atTrackExtractJobData = extractJobData;
  return extractJobData();
})();
