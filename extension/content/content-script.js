// atTrack Job Capture - Content Script Scraper

(() => {
  // Global Function for direct execution or messaging
  function extractJobData() {
    const url = window.location.href;
    const hostname = window.location.hostname.toLowerCase();

    let title = "";
    let company = "";
    let location = "";
    let salaryRange = "";
    let employmentType = "";
    let workLocation = "";
    let description = "";
    let skills = [];

    // 1. Try JSON-LD Schema (JobPosting)
    const jsonLdData = extractJsonLd();
    if (jsonLdData) {
      title = jsonLdData.title || title;
      company = jsonLdData.company || company;
      location = jsonLdData.location || location;
      salaryRange = jsonLdData.salary || salaryRange;
      employmentType = jsonLdData.employmentType || employmentType;
      description = jsonLdData.description || description;
    }

    // 2. Site-Specific Fallbacks if JSON-LD is missing fields
    if (hostname.includes("linkedin.com")) {
      const li = extractLinkedIn();
      title = title || li.title;
      company = company || li.company;
      location = location || li.location;
      description = description || li.description;
    } else if (hostname.includes("indeed.com")) {
      const ind = extractIndeed();
      title = title || ind.title;
      company = company || ind.company;
      location = location || ind.location;
      description = description || ind.description;
    } else if (hostname.includes("greenhouse.io")) {
      const gh = extractGreenhouse();
      title = title || gh.title;
      company = company || gh.company;
      location = location || gh.location;
      description = description || gh.description;
    } else if (hostname.includes("lever.co")) {
      const lev = extractLever();
      title = title || lev.title;
      company = company || lev.company;
      location = location || lev.location;
      description = description || lev.description;
    } else if (hostname.includes("glassdoor.com")) {
      const gd = extractGlassdoor();
      title = title || gd.title;
      company = company || gd.company;
      location = location || gd.location;
      description = description || gd.description;
    }

    // 3. Generic Meta & DOM Scraper Fallback
    if (!title || !company || !description) {
      const generic = extractGenericDom();
      title = title || generic.title;
      company = company || generic.company;
      location = location || generic.location;
      description = description || generic.description;
    }

    // Heuristic fixes for Title and Company from document.title if missing
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

    // Fallback for title if still blank
    if (!title) {
      const h1 = document.querySelector("h1");
      if (h1 && h1.textContent) title = h1.textContent.trim();
    }

    // Detect Work Location (Remote / Hybrid / Onsite)
    const fullText = (title + " " + location + " " + description).toLowerCase();
    if (fullText.includes("remote")) workLocation = "Remote";
    else if (fullText.includes("hybrid")) workLocation = "Hybrid";
    else if (fullText.includes("on-site") || fullText.includes("onsite") || location) workLocation = "On-site";

    // Detect Employment Type (Full-time, Part-time, Contract, Internship)
    if (!employmentType) {
      if (fullText.includes("full-time") || fullText.includes("full time")) employmentType = "Full-time";
      else if (fullText.includes("part-time") || fullText.includes("part time")) employmentType = "Part-time";
      else if (fullText.includes("contract") || fullText.includes("freelance")) employmentType = "Contract";
      else if (fullText.includes("internship") || fullText.includes("intern")) employmentType = "Internship";
    }

    // Extract technical skills keywords from description text
    skills = extractSkillKeywords(description);

    return {
      title: cleanText(title) || "Job Title",
      company: cleanText(company) || "Company Name",
      location: cleanText(location),
      salary_range: cleanText(salaryRange),
      employment_type: employmentType || "Full-time",
      work_location: workLocation || "Remote",
      application_url: url,
      source: getDomainSource(hostname),
      description: cleanText(description).slice(0, 8000),
      skills: skills.slice(0, 15),
    };
  }

  function getText(selector) {
    const el = document.querySelector(selector);
    return el ? el.textContent : "";
  }

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

          let description = job.description || "";
          if (description.includes("<")) {
            const tmp = document.createElement("div");
            tmp.innerHTML = description;
            description = tmp.textContent || tmp.innerText || "";
          }

          return {
            title,
            company,
            location,
            salary,
            employmentType: job.employmentType || "",
            description,
          };
        }
      } catch {
        // ignore
      }
    }
    return null;
  }

  function extractLinkedIn() {
    const title = getText(".job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title, h1");
    const company = getText(".job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name");
    const location = getText(".job-details-jobs-unified-top-card__bullet, .jobs-unified-top-card__bullet");
    const description = getText("#job-details, .jobs-description__content, .jobs-box__html-content");
    return { title, company, location, description };
  }

  function extractIndeed() {
    const title = getText(".jobsearch-JobInfoHeader-title, h1");
    const company = getText('[data-testid="inlineHeader-companyName"], .jobsearch-InlineCompanyHeader-companyHeader');
    const location = getText('[data-testid="inlineHeader-companyLocation"]');
    const description = getText("#jobDescriptionText");
    return { title, company, location, description };
  }

  function extractGreenhouse() {
    const title = getText(".app-title, h1.heading");
    const company = document.querySelector(".company-name, .logo img[alt]")?.getAttribute("alt") || getText(".company-name");
    const location = getText(".location");
    const description = getText("#content, #main");
    return { title, company, location, description };
  }

  function extractLever() {
    const title = getText(".posting-header h2, h2");
    const company = document.querySelector(".main-header logo img[alt]")?.getAttribute("alt") || "";
    const location = getText(".posting-categories .location");
    const description = getText(".content-wrapper, .section.page-centered");
    return { title, company, location, description };
  }

  function extractGlassdoor() {
    const title = getText('[data-test="job-title"], h1');
    const company = getText('[data-test="employer-name"]');
    const location = getText('[data-test="location"]');
    const description = getText(".jobDescriptionContent, .desc");
    return { title, company, location, description };
  }

  function extractGenericDom() {
    const title = getText("h1") || document.querySelector('meta[property="og:title"]')?.getAttribute("content") || "";
    const company = document.querySelector('meta[property="og:site_name"]')?.getAttribute("content") || "";
    const location = getText('[class*="location"], [id*="location"]');
    
    // Clean description text extraction
    let description = "";
    const mainEl = document.querySelector("main, article, [role='main'], #content, .content, .description");
    if (mainEl) {
      description = mainEl.textContent || "";
    } else {
      const clone = document.body.cloneNode(true);
      const toRemove = clone.querySelectorAll("script, style, nav, footer, header, svg, iframe");
      toRemove.forEach((el) => el.remove());
      description = clone.textContent || "";
    }

    return { title, company, location, description };
  }

  function extractSkillKeywords(text) {
    if (!text) return [];
    const techSkills = [
      "React", "Next.js", "TypeScript", "JavaScript", "Node.js", "Python", "Java", "C++", "C#", "Go", "Rust",
      "Ruby", "PHP", "Swift", "Kotlin", "HTML", "CSS", "Tailwind", "PostgreSQL", "MySQL", "MongoDB", "Redis",
      "GraphQL", "REST API", "Docker", "Kubernetes", "AWS", "GCP", "Azure", "Git", "CI/CD", "Linux",
      "Spring Boot", "Django", "FastAPI", "Express", "Vite", "Redux", "Zustand", "Jest", "Cypress", "Playwright"
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
    if (hostname.includes("linkedin.com")) return "LinkedIn";
    if (hostname.includes("indeed.com")) return "Indeed";
    if (hostname.includes("greenhouse.io")) return "Greenhouse";
    if (hostname.includes("lever.co")) return "Lever";
    if (hostname.includes("glassdoor.com")) return "Glassdoor";
    if (hostname.includes("workable.com")) return "Workable";
    return hostname.replace("www.", "");
  }

  // Register listener for messaging
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

  // Expose function globally for direct scripting execution
  window.atTrackExtractJobData = extractJobData;
  return extractJobData();
})();
