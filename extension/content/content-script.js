// atTrack Universal Job Scraper - Layer 1 Engine (DOM, DevTools, Framework & Platform Extractors) — Deep Carrier Edition
// Deep scraping: AI-native HTML snapshot + expanded carrier/platform extractors + BDT-aware salary + dept/vacancy carrier keywords
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

      // --- 3. Platform-Specific & Carrier Extractors (expanded) ---
      const platformData = extractPlatformSpecific(hostname, url);
      if (platformData) {
        title = title || platformData.title;
        company = company || platformData.company;
        location = location || platformData.location;
        salaryRange = salaryRange || platformData.salary;
        description = description || platformData.description;
        // Keep carrier precision — platform extractors for career pages get priority label
        if (!extractionMethod || extractionMethod === "DOM Heuristic" || platformData.platform?.includes("EximusEdu") || platformData.platform?.includes("Carrier")) {
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

      // --- 4b. Career Page Deep Scan (carrier keywords sweep) ---
      // If still thin, scan the whole page for carrier-native labeled fields (common on BD career pages)
      const carrierDeep = extractCarrierDeepScan();
      if (carrierDeep.title) title = title || carrierDeep.title;
      if (carrierDeep.company) company = company || carrierDeep.company;
      if (!salaryRange && carrierDeep.salary) salaryRange = carrierDeep.salary;
      if (!experience && carrierDeep.experience) experience = carrierDeep.experience;
      if (!department && carrierDeep.department) department = carrierDeep.department;
      if (!vacancy && carrierDeep.vacancy) vacancy = carrierDeep.vacancy;
      if (!location && carrierDeep.location) location = carrierDeep.location;
      // If deep scan found something, mark method as Carrier Deep when still heuristic
      if ((carrierDeep.salary || carrierDeep.department || carrierDeep.vacancy) && extractionMethod === "DOM Heuristic") {
        extractionMethod = "Carrier Deep Scan";
      }

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

      if (!company) {
        const ogSiteName = document.querySelector('meta[property="og:site_name"]')?.getAttribute("content");
        if (ogSiteName) company = ogSiteName;
        else {
          const cleanHost = hostname.replace(/^www\./, "").split(".")[0];
          if (cleanHost && cleanHost !== "localhost") company = cleanHost.charAt(0).toUpperCase() + cleanHost.slice(1);
        }
      }
      if (!title) {
        const h1 = document.querySelector("h1");
        if (h1 && h1.textContent) title = h1.textContent.trim();
      }

      // --- 6. Multi-Currency & Monthly Salary Extractor (BDT-aware deep) ---
      const pageFullText = (document.body.innerText || description || "").slice(0, 20000);
      const pageFullTextForSalary = pageFullText;
      if (!salaryRange) salaryRange = extractSalaryFromText(pageFullTextForSalary);

      // --- 7. Additional Job Meta Fields (Experience, Department, Vacancies) — carrier expanded ---
      if (!experience) experience = extractMetaField(pageFullText, ["Experience Required", "Experience", "Min Experience", "Years of Experience", "Exp ", "Exp:", "Employment Status"]);
      if (!department) department = extractMetaField(pageFullText, ["Department", "Dept", "Functional Area", "Function", "Team", "Category", "Division", "Dept."]);
      if (!vacancy) vacancy = extractMetaField(pageFullText, ["Vacancy", "Vacancies", "No. of Vacancies", "Number of Vacancies", "Openings", "Positions", "Vacancy:"]);

      // Carrier-specific labeled fields sweep (BD style: "Job Location: Dhaka", "Salary: Negotiable/BDT 40K")
      const carrierLabels = extractCarrierLabeledFields(pageFullText);
      if (carrierLabels.location) location = location || carrierLabels.location;
      if (carrierLabels.salary && !salaryRange) salaryRange = carrierLabels.salary;
      if (carrierLabels.experience && !experience) experience = carrierLabels.experience;
      if (carrierLabels.department && !department) department = carrierLabels.department;

      // --- 8. Work Location Mode Detection ---
      const fullTextLower = (title + " " + location + " " + description + " " + pageFullText.slice(0, 3000)).toLowerCase();
      workLocation = normalizeWorkLocation(workLocation || location || fullTextLower);

      // --- 9. Employment Type Detection & Normalization ---
      employmentType = normalizeEmploymentType(employmentType || fullTextLower);

      // --- 10. Technical Skills Dictionary (expanded) ---
      skills = extractSkillKeywords(description + " " + title + " " + pageFullText.slice(0, 5000));

      // --- 11. Deep HTML snapshot for AI-native scraping ---
      // This is the key upgrade: send cleaned, carrier-aware HTML to the LLM instead of only truncated text.
      // The model sees structure (headings, lists, tables for salary/dept/vacancy) — far beyond manual capping.
      const htmlSnapshot = extractCleanHtmlSnapshot();
      const cleanPageText = (title + "\n" + company + "\n" + location + "\n" + (salaryRange ? "Salary: " + salaryRange + "\n" : "") + (department ? "Dept: " + department + "\n" : "") + (experience ? "Exp: " + experience + "\n" : "") + "\n\n" + description).slice(0, 12000);
      const fullTextForAI = (pageFullText || "").slice(0, 15000);

      return {
        title: cleanText(title) || "Job Position",
        company: cleanText(company) || "Company Name",
        location: cleanText(location),
        salary_range: cleanText(salaryRange),
        employment_type: employmentType,
        work_location: workLocation,
        application_url: url,
        source: getDomainSource(hostname),
        description: cleanText(description).slice(0, 15000),
        experience: cleanText(experience),
        department: cleanText(department),
        vacancy: cleanText(vacancy),
        skills: skills.slice(0, 20),
        extraction_method: extractionMethod,
        clean_page_text: cleanPageText,
        full_page_text: fullTextForAI,
        html_snapshot: htmlSnapshot,
        carrier_meta: carrierLabels,
        is_carrier_page: isCarrierPage(url, hostname),
      };
    } catch (err) {
      console.warn("[atTrack Content Script] Job extraction warning:", err);
      return {
        title: document.title || "Job Position",
        company: window.location.hostname.replace("www.", ""),
        application_url: window.location.href,
        description: (document.body.innerText || "").slice(0, 8000),
        extraction_method: "Fallback DOM",
        clean_page_text: (document.body.innerText || "").slice(0, 8000),
        html_snapshot: "",
        full_page_text: (document.body.innerText || "").slice(0, 8000),
      };
    }
  }

  function getText(selector) {
    try {
      const el = document.querySelector(selector);
      return el ? (el.textContent || "").trim() : "";
    } catch { return ""; }
  }

  function getHtml(selector) {
    try {
      const el = document.querySelector(selector);
      return el ? el.innerHTML || "" : "";
    } catch { return ""; }
  }

  function decodeHtmlAndClean(str) {
    if (!str) return "";
    let text = str;
    try {
      const textarea = document.createElement("textarea");
      textarea.innerHTML = str;
      text = textarea.value || textarea.textContent || str;
    } catch {}
    text = text.replace(/<[^>]*>/g, " ");
    text = text.replace(/space;pre;white-space:[^;]+;/gi, " ");
    text = text.replace(/(?:dir|style|class|id)=&quot;[^&]*&quot;/gi, " ");
    text = text.replace(/(?:dir|style|class|id)="[^"]*"/gi, " ");
    text = text.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&#39;/g, "'");
    return text.replace(/\s+/g, " ").trim();
  }

  function normalizeEmploymentType(raw) {
    if (!raw) return "Full-time";
    const str = String(raw).toUpperCase();
    if (str.includes("FULL") || str.includes("PERMANENT")) return "Full-time";
    if (str.includes("PART")) return "Part-time";
    if (str.includes("CONTRACT") || str.includes("FREELANCE") || str.includes("TEMPORARY")) return "Contract";
    if (str.includes("INTERN")) return "Internship";
    return "Full-time";
  }

  function normalizeWorkLocation(raw) {
    if (!raw) return "On-site";
    const str = String(raw).toUpperCase();
    if (str.includes("REMOTE") || str.includes("WORK FROM HOME") || str.includes("TELECOMMUTE") || str.includes("WFH")) return "Remote";
    if (str.includes("HYBRID")) return "Hybrid";
    return "On-site";
  }

  // Multi-Currency & BDT-aware Salary Extractor — deep for carrier pages
  function extractSalaryFromText(text) {
    if (!text) return "";
    const patterns = [
      // Carrier BD: "Compensation BDT 40K", "Salary: BDT 30,000 - 50,000", "Tk. 40,000", "BDT 40K"
      /(?:Compensation|Salary|Pay|Package|Remuneration)\s*[:\-]?\s*(?:BDT|Tk\.?|USD|EUR|GBP|INR|₹|\$|£|€)?\s*[\d,]+\s*(?:[\-–—to]+\s*[\d,]+\s*)?(?:\s*(?:K|k|thousand|lakh|per\s*month|\/month|\/mo|\/year|\/yr|BDT|Taka))?/i,
      /(?:BDT|Tk\.?|USD|EUR|GBP|INR|₹|\$|£|€)\s*[\d,]+\s*(?:[\-–—to]+\s*[A-Z]{0,3}\s*[\d,]+\s*)?(?:\s*(?:K|k|thousand|lakh|per\s*month|\/month|\/mo|\/year|\/yr))?/i,
      /[\d,]+\s*(?:BDT|Tk\.?|Taka)\s*(?:per\s*month|\/month|\/mo)?/i,
      /Salary\s*[:\-]?\s*Negotiable/i,
      /Compensation\s*[:\-]?\s*[^\n]{3,30}/i,
    ];
    for (const pat of patterns) {
      const match = text.match(pat);
      if (match) {
        const val = match[0].replace(/\s+/g, " ").trim();
        // Filter tiny false positives like "Salary: " with no amount
        if (val.length > 8) return val.slice(0, 80);
      }
    }
    return "";
  }

  function extractMetaField(text, keywords) {
    for (const kw of keywords) {
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`(?:${escaped})\\s*[:\\-]?\\s*([^\\n\\r]{2,80}?)(?:\\n|\\r|$|\\s{2,}|;|,\\s*[A-Z][a-z]+\\s*:)`, "i");
      const match = text.match(regex);
      if (match && match[1]) {
        const val = match[1].trim().replace(/\s+/g, " ");
        if (val.length >= 2 && val.length <= 80 && !/^[:\-]+$/.test(val)) return val;
      }
    }
    return "";
  }

  // Extract labeled carrier fields common on BD career pages
  function extractCarrierLabeledFields(text) {
    const fields = {};
    const pairs = [
      { key: "location", labels: ["Job Location", "Location", "Workplace", "Office Location", "Posting Location"] },
      { key: "salary", labels: ["Salary", "Compensation", "Salary Range", "Pay Scale", "Remuneration"] },
      { key: "experience", labels: ["Experience", "Exp ", "Experience Required", "Min Experience", "Years of Experience", "Employment Status"] },
      { key: "department", labels: ["Department", "Dept", "Functional Area", "Category", "Division", "Business Unit"] },
      { key: "vacancy", labels: ["Vacancy", "No. of Vacancies", "Positions", "Openings"] },
      { key: "employmentType", labels: ["Employment Status", "Job Type", "Employment Type"] },
    ];
    for (const { key, labels } of pairs) {
      const val = extractMetaField(text, labels);
      if (val) fields[key] = val;
    }
    // Also try to find "BDT" salary line even without label
    if (!fields.salary) {
      const bdtMatch = text.match(/(?:BDT|Tk\.?|Taka)[^\n]{4,40}/i);
      if (bdtMatch) fields.salary = bdtMatch[0].trim().slice(0, 80);
    }
    return fields;
  }

  function extractCarrierDeepScan() {
    const text = (document.body.innerText || "").slice(0, 15000);
    const result = {};
    // Title: often bold heading with "Junior", "Executive", "Officer", "Engineer", "Manager" near top
    const h1 = document.querySelector("h1, h2[class*='title'], .job-title, .career-title");
    if (h1 && h1.textContent && h1.textContent.trim().length > 5) result.title = h1.textContent.trim();
    // Company: try EximusEdu specific, then generic
    if (!result.company) {
      const eximus = document.body.innerText.match(/EximusEdu|Eximus Edu/i);
      if (eximus) result.company = "EximusEdu";
    }
    result.salary = extractSalaryFromText(text);
    result.experience = extractMetaField(text, ["Experience", "Exp", "Years"]);
    result.department = extractMetaField(text, ["Department", "Dept", "Category"]);
    result.vacancy = extractMetaField(text, ["Vacancy", "Vacancies", "Positions"]);
    result.location = extractMetaField(text, ["Job Location", "Location"]);
    return result;
  }

  function isCarrierPage(url, hostname) {
    const u = (url || "").toLowerCase();
    const h = (hostname || "").toLowerCase();
    const carrierHints = ["/careers", "/career", "/jobs", "/job/", "/vacancy", "/vacancies", "/join-us", "/join-", "/opportunity", "/opening", "/hiring", "m2s-job", "freshteam", "eximusedu"];
    return carrierHints.some((hint) => u.includes(hint) || h.includes(hint.replace("/", "")));
  }

  // Deep HTML snapshot — cleaned main content for AI scraping (replaces manual capping)
  function extractCleanHtmlSnapshot() {
    try {
      // Prefer main career content containers
      const candidates = [
        "main", "article", "[role='main']", "#content", ".content", ".job-description", ".career-details",
        ".description", ".job-details", "[itemprop='description']", ".posting", ".job-posting"
      ];
      let root = null;
      for (const sel of candidates) {
        const el = document.querySelector(sel);
        if (el && (el.innerText || "").trim().length > 300) { root = el; break; }
      }
      if (!root) root = document.body;

      const clone = root.cloneNode(true);
      // Remove noise but KEEP structure (headings, lists, tables for salary/dept/vacancy)
      const noise = clone.querySelectorAll("script, style, noscript, iframe, svg, canvas, nav, footer, header, form, button, .cookie, .popup, .modal, .advert, .ad-");
      noise.forEach((el) => el.remove());

      // Strip heavy attributes but keep text structure and a few useful attrs
      const all = clone.querySelectorAll("*");
      all.forEach((el) => {
        // Keep only class if it hints at job fields, else strip
        const keepClass = el.className && typeof el.className === "string" && /job|career|description|location|salary|department|vacancy|requirement|responsibility|benefit/i.test(el.className);
        // Remove all attributes then optionally restore useful ones
        const attrs = Array.from(el.attributes || []);
        attrs.forEach((a) => el.removeAttribute(a.name));
        if (keepClass && el.getAttribute) {
          // we already removed; re-add a simplified hint via data-keep? skip — just keep tag
        }
        // Remove hidden elements
        if (el.style && el.style.display === "none") el.remove();
      });

      let html = clone.innerHTML || clone.textContent || "";
      // Clean up: remove excessive whitespace, comments, empty tags
      html = html.replace(/<!--[\s\S]*?-->/g, " ");
      html = html.replace(/\s+/g, " ");
      // Keep readable but bounded for AI token budget
      html = html.trim().slice(0, 35000);
      // Encode safely for JSON transport (keep tags for structure)
      return html;
    } catch {
      return "";
    }
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
          if (typeof job.hiringOrganization === "object") company = job.hiringOrganization.name || "";
          else if (typeof job.hiringOrganization === "string") company = job.hiringOrganization;

          let location = "";
          if (job.jobLocation) {
            const locs = Array.isArray(job.jobLocation) ? job.jobLocation : [job.jobLocation];
            location = locs.map((l) => {
              if (l.address) {
                const a = l.address;
                return [a.addressLocality, a.addressRegion, a.addressCountry].filter(Boolean).join(", ");
              }
              return l.name || "";
            }).filter(Boolean).join(" | ");
          }

          let salary = "";
          if (job.baseSalary) {
            const s = job.baseSalary;
            if (s.value) {
              const val = typeof s.value === "object" ? `${s.value.minValue || ""}-${s.value.maxValue || s.value.value || ""}` : s.value;
              salary = `${s.currency || "$"} ${val} ${s.value.unitText ? "/" + s.value.unitText : ""}`.trim();
            }
          }
          return { title, company, location, salary, employmentType: job.employmentType || "", description: job.description || "" };
        }
      } catch {}
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
          const jobObj = pageProps.job || pageProps.posting || pageProps.jobDetails || pageProps.initialJob || pageProps.position || pageProps.data?.job;
          if (jobObj && typeof jobObj === "object") {
            return {
              title: jobObj.title || jobObj.name || jobObj.positionTitle || "",
              company: jobObj.company?.name || jobObj.companyName || jobObj.company || "",
              location: jobObj.location || jobObj.locationName || "",
              salary: jobObj.salary || jobObj.salaryRange || jobObj.compensation || "",
              description: jobObj.description || jobObj.details || jobObj.content || "",
            };
          }
        }
      }
      // Also check Nuxt / generic hydration
      const nuxt = document.querySelector("#__NUXT_DATA__");
      if (nuxt && nuxt.textContent) {
        const data = JSON.parse(nuxt.textContent);
        const jobObj = data?.data?.[0]?.job || data?.job;
        if (jobObj) return { title: jobObj.title || "", company: jobObj.company || "", location: jobObj.location || "", salary: jobObj.salary || "", description: jobObj.description || "" };
      }
    } catch {}
    return null;
  }

  // Layer 1.3: Platform Extractors — expanded for carrier pages
  function extractPlatformSpecific(hostname, url) {
    // EximusEdu / BD carrier (priority — fixes screenshot case)
    if (hostname.includes("eximusedu.com") || hostname.includes("eximus") || url.includes("eximusedu")) {
      // Try structured carrier table first
      const deep = extractCarrierDeepScan();
      return {
        platform: "EximusEdu - Carrier Deep",
        title: getText("h1, h2, .job-title, .career-title, .posting-title") || deep.title || "",
        company: "EximusEdu",
        location: getText(".job-location, .location, [class*='location']") || deep.location || "Dhaka, Bangladesh",
        salary: deep.salary || extractSalaryFromText(document.body.innerText || ""),
        description: getText(".job-description, .career-details, .job-content, main, article") || getHtml(".job-description, .career-details") || "",
      };
    }
    if (hostname.includes("onnorokomprojukti.com") || url.includes("m2s-job-application")) {
      return {
        platform: "OnnoRokom Projukti",
        title: getText(".job-title, .career-title, h1, h2"),
        company: "OnnoRokom Projukti",
        location: getText(".job-location, .location") || "Dhaka, Bangladesh",
        description: getText(".job-description, .career-details, main, body"),
      };
    }
    if (hostname.includes("bdjobs.com")) {
      return {
        platform: "Bdjobs - Carrier",
        title: getText("h1, .job-title, .jobTitle"),
        company: getText(".company-name, .comp-name, [class*='company']") || "Bdjobs Company",
        location: getText(".location, [class*='location']"),
        description: getText(".job-desc, .job-description, #jobDesc, main"),
      };
    }
    if (hostname.includes("freshteam.com")) {
      return { platform: "Freshteam", title: getText(".job-title, h1, h2"), company: getText(".company-name, .logo img[alt]") || document.title.split("-")[0]?.trim(), location: getText(".location, .job-location"), description: getText(".job-description, .description-container, body") };
    }
    if (hostname.includes("linkedin.com")) {
      const isLinkedinJob = url.includes("/jobs/") || url.includes("/jobs") || url.includes("currentjobid=");
      if (!isLinkedinJob) return null;

      const title = getText(
        ".job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title, .jobs-search__job-details--container h1, .jobs-search__job-details--container h2, .job-details-jobs-unified-top-card__job-title-link, .topcard__title, h1.t-24, .jobs-details__main-content h1"
      );
      if (!title || /^(feed|notifications|messaging|my network|linkedin|jobs|home|search|job search)$/i.test(title.trim())) {
        return null;
      }

      return {
        platform: "LinkedIn",
        title,
        company: getText(".job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name, .jobs-unified-top-card__subtitle-primary-grouping a, .topcard__org-name-link, [data-tracking-control-name='public_jobs_topcard-org-name'], .job-details-jobs-unified-top-card__primary-description a, .jobs-unified-top-card__primary-description a"),
        location: getText(".job-details-jobs-unified-top-card__bullet, .jobs-unified-top-card__bullet, .jobs-unified-top-card__workplace-type, .topcard__flavor--bullet, .job-details-jobs-unified-top-card__primary-description-container"),
        description: getText("#job-details, .jobs-description__content, .jobs-description-content__text, .jobs-box__html-content, article.jobs-description__container, .jobs-description"),
      };
    }
    if (hostname.includes("indeed.com")) {
      return { platform: "Indeed", title: getText(".jobsearch-JobInfoHeader-title, h1"), company: getText('[data-testid="inlineHeader-companyName"], .jobsearch-InlineCompanyHeader-companyHeader'), location: getText('[data-testid="inlineHeader-companyLocation"]'), description: getText("#jobDescriptionText") };
    }
    if (hostname.includes("greenhouse.io")) {
      return { platform: "Greenhouse", title: getText(".app-title, h1.heading"), company: document.querySelector(".company-name, .logo img[alt]")?.getAttribute("alt") || getText(".company-name"), location: getText(".location"), description: getText("#content, #main") };
    }
    if (hostname.includes("lever.co")) {
      return { platform: "Lever", title: getText(".posting-header h2, h2"), company: document.querySelector(".main-header logo img[alt]")?.getAttribute("alt") || getText(".company-name"), location: getText(".posting-categories .location"), description: getText(".content-wrapper, .section.page-centered") };
    }
    if (hostname.includes("workday.com") || hostname.includes("myworkdayjobs.com")) {
      return { platform: "Workday - Carrier", title: getText("h1, [data-automation-id='jobPostingHeader'], .job-title"), company: getText("[data-automation-id='company'], .company") || hostname.split(".")[0], location: getText("[data-automation-id='locations'], .location"), description: getText("[data-automation-id='jobPostingDescription'], .job-description, main") };
    }
    if (hostname.includes("ashbyhq.com")) {
      return { platform: "Ashby - Carrier", title: getText("h1, .ashby-job-title"), company: getText(".ashby-company-name, [class*='company']"), location: getText(".ashby-job-location, [class*='location']"), description: getText(".ashby-job-description, main, article") };
    }
    if (hostname.includes("smartrecruiters.com")) {
      return { platform: "SmartRecruiters - Carrier", title: getText("h1, .job-title"), company: getText(".company-name"), location: getText(".job-location"), description: getText(".job-description, #st-jobDesc, main") };
    }
    if (hostname.includes("glassdoor.com")) {
      return { platform: "Glassdoor", title: getText("h1, .job-title"), company: getText(".employer-name, [class*='employer']"), location: getText(".location, [class*='location']"), description: getText(".jobDescriptionContent, .desc, main") };
    }
    if (hostname.includes("bamboohr.com")) {
      return { platform: "BambooHR - Carrier", title: getText("h1, .JobPostingTitle"), company: getText(".CompanyName"), location: getText(".Location"), description: getText(".JobPostingContent, main") };
    }
    // Generic carrier detection fallback — treat any /careers/* as carrier
    if (isCarrierPage(url, hostname)) {
      const deep = extractCarrierDeepScan();
      return {
        platform: "Carrier Generic - Deep",
        title: getText("h1, h2, .job-title, .career-title") || deep.title || "",
        company: getText(".company-name, [class*='company']") || deep.company || "",
        location: getText(".location, [class*='location']") || deep.location || "",
        description: getText("main, article, .job-description, .content") || "",
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
    const mainEl = document.querySelector('[itemprop="description"], main, article, [role="main"], #content, .content, .description, .job-desc');
    if (mainEl) description = mainEl.textContent || "";
    else {
      const clone = document.body.cloneNode(true);
      clone.querySelectorAll("script, style, nav, footer, header, svg, iframe, noscript").forEach((el) => el.remove());
      description = clone.textContent || "";
    }
    return { title, company, location, description };
  }

  function extractSkillKeywords(text) {
    if (!text) return [];
    const techSkills = [
      "React", "Next.js", "TypeScript", "JavaScript", "Node.js", "Python", "Java", "C++", "C#", "Go", "Rust", "Ruby", "PHP", "Swift", "Kotlin", "HTML", "CSS", "Tailwind", "PostgreSQL", "MySQL", "MongoDB", "Redis", "GraphQL", "REST API", "Docker", "Kubernetes", "AWS", "GCP", "Azure", "Git", "CI/CD", "Linux", "Spring Boot", "Django", "FastAPI", "Express", "Vite", "Redux", "Zustand", "Jest", "Cypress", "Playwright", "SQL", "NoSQL", "Kafka", "Elasticsearch", "Terraform", "Microservices", "System Design", "Agile", "Scrum", "Jira", "Linear", "ClickUp", "Trello", "G Suite", "Microsoft Office", "BBA", "CSE", "Project Management", "RDBMS", "MySQL/PostgreSQL", "jQuery", "Laravel", "Figma", "Photoshop"
    ];
    const found = [];
    const textLower = text.toLowerCase();
    for (const skill of techSkills) {
      const regex = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (regex.test(textLower)) found.push(skill);
    }
    // Also capture BDT-style: "BDT 40K" nearby skills
    return [...new Set(found)];
  }

  function cleanText(str) { if (!str) return ""; return str.replace(/\s+/g, " ").trim(); }

  function getDomainSource(hostname) {
    if (hostname.includes("eximusedu.com") || hostname.includes("eximus")) return "EximusEdu";
    if (hostname.includes("bdjobs.com")) return "Bdjobs";
    if (hostname.includes("onnorokomprojukti.com")) return "OnnoRokom Projukti";
    if (hostname.includes("freshteam.com")) return "Freshteam";
    if (hostname.includes("linkedin.com")) return "LinkedIn";
    if (hostname.includes("indeed.com")) return "Indeed";
    if (hostname.includes("greenhouse.io")) return "Greenhouse";
    if (hostname.includes("lever.co")) return "Lever";
    if (hostname.includes("glassdoor.com")) return "Glassdoor";
    if (hostname.includes("workday.com") || hostname.includes("myworkdayjobs.com")) return "Workday";
    if (hostname.includes("ashbyhq.com")) return "Ashby";
    if (hostname.includes("smartrecruiters.com")) return "SmartRecruiters";
    if (hostname.includes("bamboohr.com")) return "BambooHR";
    return hostname.replace("www.", "");
  }

  if (!window.__atTrackContentScriptLoaded) {
    window.__atTrackContentScriptLoaded = true;
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === "EXTRACT_JOB_DETAILS") {
        try { const details = extractJobData(); sendResponse({ success: true, data: details }); }
        catch (err) { sendResponse({ success: false, error: err.message || String(err) }); }
      }
      return true;
    });
  }
  window.atTrackExtractJobData = extractJobData;
  return extractJobData();
})();
