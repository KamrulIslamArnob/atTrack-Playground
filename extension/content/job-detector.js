// atTrack Job Detector & Smart Prompt Overlay (Manifest V3)
// Detects job postings on webpages, renders floating prompt toast & docked edge trigger,
// and opens the official atTrack extension popup directly upon click.

(() => {
  if (window.__atTrackJobDetectorLoaded) return;
  window.__atTrackJobDetectorLoaded = true;

  const hostname = window.location.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    window.location.protocol === "chrome-extension:" ||
    window.location.protocol === "about:"
  ) {
    return;
  }

  let shadowRoot = null;
  let overlayHost = null;
  let currentJobData = null;
  let lastJobFingerprint = "";
  let isPromptVisible = true;
  let isSidePanelOpen = false;
  let debounceTimer = null;

  // Listen for side panel open/close messages
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "SIDE_PANEL_OPENED") {
      isSidePanelOpen = true;
      if (overlayHost) {
        overlayHost.style.display = "none";
      }
    } else if (msg.type === "SIDE_PANEL_CLOSED") {
      isSidePanelOpen = false;
      if (currentJobData && isJobPostingCandidate()) {
        isPromptVisible = true;
        if (overlayHost) {
          overlayHost.style.display = "block";
          updateOverlayContent();
        } else {
          renderOverlay();
        }
      }
    }
  });

  // Check user settings before initializing
  chrome.storage.local.get(["onPagePromptEnabled"], (res) => {
    if (res && res.onPagePromptEnabled === false) {
      return; // User disabled on-page prompts
    }
    initJobDetector();
  });

  // Listen for storage changes
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local") {
      if (changes.onPagePromptEnabled) {
        if (changes.onPagePromptEnabled.newValue === false) {
          removeOverlay();
        } else {
          scheduleDetection(100);
        }
      }
    }
  });

  function initJobDetector() {
    // Initial detection retry ladder for SPAs
    scheduleDetection(300);
    scheduleDetection(1000);
    scheduleDetection(2500);
    scheduleDetection(5000);

    // Watch for DOM mutations (React SPAs updating job pane)
    const observer = new MutationObserver(() => {
      scheduleDetection(400);
    });

    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    } else {
      document.addEventListener("DOMContentLoaded", () => {
        if (document.body) observer.observe(document.body, { childList: true, subtree: true });
      });
    }

    // Intercept SPA client-side navigations
    const originalPushState = history.pushState;
    if (typeof originalPushState === "function") {
      history.pushState = function (...args) {
        const res = originalPushState.apply(this, args);
        scheduleDetection(300);
        return res;
      };
    }

    const originalReplaceState = history.replaceState;
    if (typeof originalReplaceState === "function") {
      history.replaceState = function (...args) {
        const res = originalReplaceState.apply(this, args);
        scheduleDetection(300);
        return res;
      };
    }

    window.addEventListener("popstate", () => scheduleDetection(300));
    window.addEventListener("hashchange", () => scheduleDetection(300));

    // Intercept user clicks on job listings
    document.addEventListener("click", (e) => {
      const target = e.target;
      if (!target) return;
      const isJobClick = !!target.closest(
        "a[href*='/jobs/'], a[href*='currentJobId='], [data-job-id], .job-card-container, .jobs-search-results__list-item, .jobsearch-ResultsList > li, a[class*='job']"
      );
      if (isJobClick) {
        scheduleDetection(500);
        scheduleDetection(1500);
      }
    }, { passive: true });
  }

  function scheduleDetection(delayMs = 300) {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(runDetection, delayMs);
  }

  function runDetection() {
    if (isSidePanelOpen) {
      if (overlayHost) overlayHost.style.display = "none";
      return;
    }
    if (!isJobPostingCandidate()) {
      if (overlayHost) {
        overlayHost.style.display = "none";
      }
      return;
    }

    // Extract job details
    const data = extractCurrentJob();
    if (!data || !data.title || data.title.length < 2 || isBlacklistedTitle(data.title)) {
      if (overlayHost) {
        overlayHost.style.display = "none";
      }
      return;
    }

    const fingerprint = `${data.title}:::${data.company || ""}`;
    const isNewJob = fingerprint !== lastJobFingerprint;
    lastJobFingerprint = fingerprint;

    currentJobData = data;

    // Check if dismissed in this session for this specific job URL
    const urlKey = "attrack_dismissed_" + window.location.pathname + window.location.search;
    const isDismissed = sessionStorage.getItem(urlKey) === "true";

    if (isDismissed) {
      if (overlayHost) {
        overlayHost.style.display = "none";
      }
      return;
    }

    if (isNewJob) {
      isPromptVisible = true;
    }

    renderOverlay();
  }

  function isBlacklistedTitle(title) {
    if (!title) return true;
    const lower = title.toLowerCase().trim();
    return [
      "feed",
      "notifications",
      "messaging",
      "my network",
      "linkedin",
      "jobs",
      "job position",
      "home",
      "search",
      "job search",
      "manage my network",
      "sign in",
      "sign up",
      "log in",
      "welcome",
      "page not found",
      "404",
      "about us",
      "careers",
    ].includes(lower);
  }

  // Fast candidate check
  function isJobPostingCandidate() {
    const url = window.location.href.toLowerCase();
    const host = window.location.hostname.toLowerCase();

    // On LinkedIn: ONLY match actual /jobs/ paths
    if (host.includes("linkedin.com")) {
      return url.includes("/jobs/") || url.includes("currentjobid=");
    }

    // 1. JSON-LD Schema.org JobPosting check
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const s of scripts) {
      try {
        const text = s.textContent || "";
        if (text.includes('"JobPosting"') || text.includes('"@type":"JobPosting"')) {
          return true;
        }
      } catch {}
    }

    // 2. Microdata itemType check
    if (document.querySelector('[itemtype*="JobPosting"], [itemprop="JobPosting"]')) {
      return true;
    }

    // 3. Known ATS platforms and job boards
    const atsDomains = [
      "indeed.com",
      "glassdoor.com",
      "greenhouse.io",
      "lever.co",
      "ashbyhq.com",
      "workday.com",
      "myworkdayjobs.com",
      "smartrecruiters.com",
      "bamboohr.com",
      "freshteam.com",
      "recruitee.com",
      "jobvite.com",
      "applytojob.com",
      "workable.com",
      "breezy.hr",
      "rippling-ats.com",
      "bdjobs.com",
      "wellfound.com",
      "ziprecruiter.com",
      "dice.com",
      "monster.com",
    ];
    if (atsDomains.some((d) => host.includes(d))) {
      return true;
    }

    // 4. URL path hints
    if (
      url.includes("/job/") ||
      url.includes("/jobs/") ||
      url.includes("/careers/") ||
      url.includes("/career/") ||
      url.includes("/vacancy/") ||
      url.includes("/vacancies/") ||
      url.includes("/opening/") ||
      url.includes("/openings/") ||
      url.includes("/positions/") ||
      url.includes("/position/") ||
      url.includes("jobid=")
    ) {
      return true;
    }

    // 5. DOM semantic keywords check
    const bodyText = (document.body?.innerText || "").slice(0, 8000);
    const hasJobKeywords =
      /(?:Apply Now|Apply for this job|Job Description|Role Overview|About the Role|Key Responsibilities|Qualifications|Requirements|What You'll Do|Salary Range)/i.test(bodyText);
    const hasApplyButton = !!document.querySelector(
      "a[href*='apply'], button[class*='apply'], button[id*='apply'], a[class*='apply'], [data-automation-id*='apply']"
    );

    return hasJobKeywords && hasApplyButton;
  }

  // Reliable job extraction helper
  function extractCurrentJob() {
    if (typeof window.atTrackExtractJobData === "function") {
      const parsed = window.atTrackExtractJobData();
      if (parsed && parsed.title && !isBlacklistedTitle(parsed.title)) {
        return parsed;
      }
    }

    // Fallback extraction logic directly inside detector
    const host = window.location.hostname.toLowerCase();
    const url = window.location.href;

    let title = "";
    let company = "";

    if (host.includes("linkedin.com")) {
      if (!url.includes("/jobs/") && !url.includes("currentjobid=")) return null;
      title = getText(
        ".job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title, .jobs-search__job-details--container h1, .jobs-search__job-details--container h2, .job-details-jobs-unified-top-card__job-title-link, .topcard__title, h1.t-24, .jobs-details__main-content h1"
      );
      company = getText(
        ".job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name, .jobs-unified-top-card__subtitle-primary-grouping a, .topcard__org-name-link, [data-tracking-control-name='public_jobs_topcard-org-name'], .job-details-jobs-unified-top-card__primary-description a, .jobs-unified-top-card__primary-description a"
      );
    } else if (host.includes("indeed.com")) {
      title = getText(".jobsearch-JobInfoHeader-title");
      company = getText('[data-testid="inlineHeader-companyName"], .jobsearch-InlineCompanyHeader-companyHeader');
    } else {
      title = getText("[itemprop='title'], .job-title, .posting-title, .career-title");
      company = getText("[itemprop='hiringOrganization'], .company-name, .company, meta[property='og:site_name']");
    }

    if (!title || isBlacklistedTitle(title)) {
      return null;
    }

    return {
      title: cleanText(title),
      company: cleanText(company) || host.replace("www.", "").split(".")[0],
    };
  }

  function getText(selector) {
    try {
      const el = document.querySelector(selector);
      return el ? (el.textContent || "").trim() : "";
    } catch {
      return "";
    }
  }

  function cleanText(str) {
    if (!str) return "";
    return str.replace(/\s+/g, " ").trim();
  }

  function removeOverlay() {
    if (overlayHost) {
      overlayHost.remove();
      overlayHost = null;
      shadowRoot = null;
    }
  }

  function openExtensionPopup() {
    // Notify background service worker to open the Chrome Side Panel
    chrome.runtime.sendMessage({ type: "OPEN_SIDE_PANEL" }, () => {
      // Hide the entire on-page overlay while side panel opens
      isPromptVisible = false;
      if (overlayHost) {
        overlayHost.style.display = "none";
      }
    });
  }

  function renderOverlay() {
    if (!overlayHost) {
      overlayHost = document.createElement("div");
      overlayHost.id = "attrack-job-overlay-root";
      overlayHost.style.position = "fixed";
      overlayHost.style.top = "0";
      overlayHost.style.left = "0";
      overlayHost.style.width = "0";
      overlayHost.style.height = "0";
      overlayHost.style.zIndex = "2147483646";
      overlayHost.style.pointerEvents = "none";
      document.documentElement.appendChild(overlayHost);

      shadowRoot = overlayHost.attachShadow({ mode: "open" });
    }

    overlayHost.style.display = "block";
    updateOverlayContent();
  }

  function updateOverlayContent() {
    if (!shadowRoot || !currentJobData) return;

    const title = escapeHtml(currentJobData.title || "Job Position");
    const company = escapeHtml(currentJobData.company || "Company");

    const attrackIconUrl =
      typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL
        ? chrome.runtime.getURL("icons/icon-48.png")
        : "";

    shadowRoot.innerHTML = `
      <style>
        :host {
          all: initial;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, "Helvetica Neue", Arial, sans-serif;
          font-size: 14px;
          line-height: 1.5;
          color: #0f172a;
          box-sizing: border-box;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: optimizeLegibility;
        }

        *, *::before, *::after {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        /* Docked Sidebar Edge Trigger (Connected flush against right edge) */
        .attrack-dock-trigger {
          pointer-events: auto;
          position: fixed;
          right: 0;
          top: 50%;
          transform: translateY(-50%);
          z-index: 2147483646;
          width: 44px;
          height: 48px;
          border-radius: 14px 0 0 14px;
          background: #2563eb;
          box-shadow: -4px 8px 24px rgba(37, 99, 235, 0.35), -1px 2px 6px rgba(15, 23, 42, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.15s ease;
          border: 1.5px solid rgba(255, 255, 255, 0.35);
          border-right: none;
          user-select: none;
        }

        .attrack-dock-trigger:hover {
          background: #1d4ed8;
        }

        .attrack-dock-logo-img {
          width: 24px;
          height: 24px;
          object-fit: contain;
          border-radius: 6px;
          pointer-events: none;
        }

        .attrack-dock-fallback-logo {
          width: 22px;
          height: 22px;
          color: #ffffff;
          font-weight: 800;
          font-size: 15px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .attrack-pulse-dot {
          position: absolute;
          top: -2px;
          left: -2px;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #10b981;
          border: 2px solid #ffffff;
          box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
          animation: attrack-pulse 2s infinite;
        }

        @keyframes attrack-pulse {
          0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
          70% { box-shadow: 0 0 0 7px rgba(16, 185, 129, 0); }
          100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }

        /* Floating Prompt Toast */
        .attrack-prompt-toast {
          pointer-events: auto;
          position: fixed;
          right: 52px;
          top: 50%;
          transform: translateY(-50%);
          z-index: 2147483646;
          width: 320px;
          background: #ffffff;
          background-image: radial-gradient(#d7e6f7 1px, transparent 1px);
          background-size: 16px 16px;
          border-radius: 20px;
          padding: 16px 18px 18px 18px;
          box-shadow: 0 20px 40px -6px rgba(15, 23, 42, 0.14), 0 8px 16px -4px rgba(15, 23, 42, 0.06), 0 0 0 1px rgba(15, 23, 42, 0.04);
          border: 1px solid rgba(226, 232, 240, 0.95);
          display: ${isPromptVisible ? "flex" : "none"};
          flex-direction: column;
          gap: 12px;
          animation: attrack-slide-in 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          overflow: visible;
        }

        @keyframes attrack-slide-in {
          from {
            opacity: 0;
            transform: translateY(-50%) translateX(12px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(-50%) translateX(0) scale(1);
          }
        }

        /* Vector Art Corner Mask */
        .attrack-card-art-mask {
          position: absolute;
          inset: 0;
          border-radius: 20px;
          overflow: hidden;
          pointer-events: none;
          z-index: 1;
        }

        /* Background Job Icons Vector */
        .attrack-bg-job-icons {
          position: absolute;
          top: 0;
          right: 0;
          width: 135px;
          height: 100px;
          pointer-events: none;
          opacity: 0.95;
        }

        /* Outer Top-Left Corner Dismiss Button */
        .attrack-btn-dismiss-corner {
          position: absolute;
          top: -8px;
          left: -8px;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: #64748b;
          box-shadow: 0 2px 6px rgba(15, 23, 42, 0.12);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 700;
          line-height: 1;
          transition: background-color 150ms cubic-bezier(0.2, 0, 0, 1), border-color 150ms cubic-bezier(0.2, 0, 0, 1), transform 150ms cubic-bezier(0.2, 0, 0, 1), color 150ms cubic-bezier(0.2, 0, 0, 1);
          padding: 0;
          z-index: 20;
        }

        .attrack-btn-dismiss-corner:hover {
          background: #f1f5f9;
          color: #0f172a;
          border-color: #94a3b8;
          transform: scale(1.08);
        }

        .attrack-btn-dismiss-corner:active {
          transform: scale(0.96);
        }

        .attrack-prompt-content {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .attrack-prompt-title {
          font-family: 'Segoe UI', Inter, -apple-system, BlinkMacSystemFont, Roboto, 'Helvetica Neue', Arial, sans-serif !important;
          font-size: 16px;
          font-weight: 700;
          color: #0f172a;
          line-height: 1.28;
          letter-spacing: -0.02em;
          padding-right: 56px;
        }

        .attrack-prompt-chip {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          font-size: 12px;
          color: #334155;
          max-width: 100%;
          overflow: hidden;
          white-space: nowrap;
        }

        .attrack-truncate {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* Pill Action Button */
        .attrack-btn-pill {
          width: 100%;
          height: 40px;
          background: #2563eb;
          color: #ffffff;
          border: none;
          border-radius: 9999px;
          font-size: 13.5px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35);
          transition: background-color 150ms cubic-bezier(0.2, 0, 0, 1), transform 150ms cubic-bezier(0.2, 0, 0, 1), box-shadow 150ms cubic-bezier(0.2, 0, 0, 1);
        }

        .attrack-btn-pill:hover {
          background: #1d4ed8;
          transform: translateY(-1px);
          box-shadow: 0 6px 18px rgba(37, 99, 235, 0.45);
        }

        .attrack-btn-pill:active {
          transform: scale(0.96);
          box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3);
        }
      </style>

      <!-- Docked Sidebar Edge Trigger (Connected flush against right edge) -->
      <div id="attrackDockTrigger" class="attrack-dock-trigger" title="Open BetterJob Extension">
        ${
          attrackIconUrl
            ? `<img src="${attrackIconUrl}" class="attrack-dock-logo-img" alt="BetterJob" />`
            : `<div class="attrack-dock-fallback-logo">BJ</div>`
        }
        <div class="attrack-pulse-dot"></div>
      </div>

      <!-- Floating Prompt Toast (Notification pop-up) -->
      <div id="attrackPromptToast" class="attrack-prompt-toast">
        <!-- Outer Top-Left Corner Dismiss Button -->
        <button id="attrackBtnDismiss" class="attrack-btn-dismiss-corner" title="Dismiss">✕</button>

        <!-- Masked Background Vector Art -->
        <div class="attrack-card-art-mask">
          <svg class="attrack-bg-job-icons" viewBox="0 0 135 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <!-- Lavender Briefcase -->
            <g transform="translate(48, -4) rotate(14)">
              <rect x="0" y="5" width="28" height="20" rx="4" fill="#ede9fe" stroke="#8b5cf6" stroke-width="1.6"/>
              <path d="M9 5V3a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2" stroke="#8b5cf6" stroke-width="1.6" fill="none"/>
              <rect x="11" y="9" width="6" height="3.5" rx="1" fill="#8b5cf6"/>
            </g>
            <!-- Mint/Teal Briefcase -->
            <g transform="translate(90, 6) rotate(-16)">
              <rect x="0" y="5" width="26" height="19" rx="3.5" fill="#ccfbf1" stroke="#0d9488" stroke-width="1.6"/>
              <path d="M8 5V3.5a1.5 1.5 0 0 1 1.5-1.5h7a1.5 1.5 0 0 1 1.5 1.5V5" stroke="#0d9488" stroke-width="1.6" fill="none"/>
              <rect x="10" y="9" width="6" height="3" rx="1" fill="#0d9488"/>
            </g>
            <!-- Sky Blue Briefcase -->
            <g transform="translate(88, 48) rotate(18)">
              <rect x="0" y="5" width="25" height="18" rx="3.5" fill="#e0f2fe" stroke="#0284c7" stroke-width="1.6"/>
              <path d="M8 5V3.5a1.5 1.5 0 0 1 1.5-1.5h6a1.5 1.5 0 0 1 1.5 1.5V5" stroke="#0284c7" stroke-width="1.6" fill="none"/>
              <rect x="9.5" y="8.5" width="6" height="3" rx="1" fill="#0284c7"/>
            </g>
            <!-- Lime Green Briefcase -->
            <g transform="translate(58, 58) rotate(-22)">
              <rect x="0" y="4.5" width="23" height="16.5" rx="3.5" fill="#ecfccb" stroke="#65a30d" stroke-width="1.6"/>
              <path d="M7 4.5V3a1.5 1.5 0 0 1 1.5-1.5h6a1.5 1.5 0 0 1 1.5 1.5V4.5" stroke="#65a30d" stroke-width="1.6" fill="none"/>
              <rect x="8.5" y="7.5" width="6" height="3" rx="1" fill="#65a30d"/>
            </g>
          </svg>
        </div>

        <!-- Prompt Content -->
        <div class="attrack-prompt-content">
          <div class="attrack-prompt-title">Skip the hassle, start applying!</div>
          <div class="attrack-prompt-chip">
            <span>💼</span>
            <strong class="attrack-truncate">${title}</strong>
            <span>•</span>
            <span class="attrack-truncate">${company}</span>
          </div>
          <button id="attrackBtnOpenPopup" class="attrack-btn-pill">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 5v14M5 12h14"></path>
            </svg>
            <span>Add job to BetterJob</span>
          </button>
        </div>
      </div>
    `;

    bindOverlayEvents();
  }

  function bindOverlayEvents() {
    if (!shadowRoot) return;

    // Trigger click -> Open browser extension popup directly
    const trigger = shadowRoot.getElementById("attrackDockTrigger");
    if (trigger) {
      trigger.addEventListener("click", () => {
        openExtensionPopup();
      });
    }

    // Dismiss button on floating toast
    const btnDismiss = shadowRoot.getElementById("attrackBtnDismiss");
    if (btnDismiss) {
      btnDismiss.addEventListener("click", (e) => {
        e.stopPropagation();
        isPromptVisible = false;
        const urlKey = "attrack_dismissed_" + window.location.pathname + window.location.search;
        sessionStorage.setItem(urlKey, "true");
        if (overlayHost) {
          overlayHost.style.display = "none";
        }
      });
    }

    // Open extension popup from toast action button
    const btnOpenPopup = shadowRoot.getElementById("attrackBtnOpenPopup");
    if (btnOpenPopup) {
      btnOpenPopup.addEventListener("click", () => {
        openExtensionPopup();
      });
    }
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();
