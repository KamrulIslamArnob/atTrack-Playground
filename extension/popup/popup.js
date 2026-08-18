// atTrack Job Capture Extension - Multi-Layer Scraper & Hybrid Synthesis Logic

document.addEventListener("DOMContentLoaded", () => {
  const statusBadge = document.getElementById("statusBadge");
  const statusText = document.getElementById("statusText");
  const btnToggleSettings = document.getElementById("btnToggleSettings");
  const settingsPanel = document.getElementById("settingsPanel");
  const serverUrlInput = document.getElementById("serverUrlInput");
  const btnSaveServerUrl = document.getElementById("btnSaveServerUrl");
  const offlineNotice = document.getElementById("offlineNotice");
  const extractionBadge = document.getElementById("extractionBadge");
  const extractionText = document.getElementById("extractionText");
  const skillCounterBadge = document.getElementById("skillCounterBadge");
  const extraMetaPills = document.getElementById("extraMetaPills");
  const toastContainer = document.getElementById("toastContainer");

  const jobForm = document.getElementById("jobForm");
  const inputTitle = document.getElementById("inputTitle");
  const inputCompany = document.getElementById("inputCompany");
  const inputLocation = document.getElementById("inputLocation");
  const inputSalary = document.getElementById("inputSalary");
  const selectWorkLocation = document.getElementById("selectWorkLocation");
  const selectEmploymentType = document.getElementById("selectEmploymentType");
  const inputUrl = document.getElementById("inputUrl");
  const skillsTags = document.getElementById("skillsTags");
  const inputSkills = document.getElementById("inputSkills");
  const textareaDescription = document.getElementById("textareaDescription");

  const btnToggleMore = document.getElementById("btnToggleMore");
  const moreDetailsSection = document.getElementById("moreDetailsSection");
  const btnReextract = document.getElementById("btnReextract");
  const btnSubmit = document.getElementById("btnSubmit");
  const btnSubmitText = document.getElementById("btnSubmitText");
  const successBanner = document.getElementById("successBanner");
  const btnOpenBoard = document.getElementById("btnOpenBoard");

  const firecrawlKeyInput = document.getElementById("firecrawlKeyInput");
  const secretInput = document.getElementById("secretInput");

  let currentServerUrl = "http://127.0.0.1:3308";
  let currentFirecrawlKey = "";
  let activeSkills = [];
  let activeContact = null;
  let isServerOnline = false;

  init();

  async function init() {
    // Load saved server URL & Firecrawl API Key
    chrome.runtime.sendMessage({ type: "GET_SERVER_URL" }, (response) => {
      if (response && response.serverUrl) {
        currentServerUrl = response.serverUrl;
        serverUrlInput.value = currentServerUrl;
      }
      checkStatus();
    });

    chrome.storage.local.get("firecrawlApiKey", (res) => {
      if (res && res.firecrawlApiKey && firecrawlKeyInput) {
        currentFirecrawlKey = res.firecrawlApiKey;
        firecrawlKeyInput.value = currentFirecrawlKey;
      }
    });

    chrome.storage.local.get("authSecret", (res) => {
      if (res && res.authSecret && secretInput) {
        secretInput.value = res.authSecret;
      }
    });

    // Auto-extract job details from current active tab
    extractFromCurrentTab();

    // Event listeners
    btnToggleSettings.addEventListener("click", () => {
      settingsPanel.classList.toggle("hidden");
    });

    btnSaveServerUrl.addEventListener("click", () => {
      const newUrl = serverUrlInput.value.trim();
      const newFcKey = firecrawlKeyInput ? firecrawlKeyInput.value.trim() : "";
      const newSecret = secretInput ? secretInput.value.trim() : "";
      if (newUrl) {
        currentServerUrl = newUrl;
        currentFirecrawlKey = newFcKey;
        chrome.storage.local.set({ firecrawlApiKey: newFcKey, authSecret: newSecret });
        chrome.runtime.sendMessage({ type: "SET_SERVER_URL", serverUrl: newUrl }, () => {
          settingsPanel.classList.add("hidden");
          showToast("Settings updated successfully", "success");
          checkStatus();
        });
      }
    });

    btnToggleMore.addEventListener("click", () => {
      const isHidden = moreDetailsSection.classList.contains("hidden");
      if (isHidden) {
        moreDetailsSection.classList.remove("hidden");
        btnToggleMore.textContent = "Hide Details";
      } else {
        moreDetailsSection.classList.add("hidden");
        btnToggleMore.textContent = "Show Details";
      }
    });

    btnReextract.addEventListener("click", (e) => {
      e.preventDefault();
      extractFromCurrentTab();
    });

    inputSkills.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        const val = inputSkills.value.trim().replace(/,/g, "");
        if (val && !activeSkills.includes(val)) {
          activeSkills.push(val);
          renderSkills();
          inputSkills.value = "";
        }
      }
    });

    jobForm.addEventListener("submit", handleFormSubmit);
  }

  function checkStatus() {
    statusBadge.className = "status-pill checking";
    statusText.textContent = "Checking";
    offlineNotice.classList.add("hidden");

    chrome.runtime.sendMessage(
      { type: "CHECK_SERVER_STATUS", serverUrl: currentServerUrl },
      (response) => {
        if (response && response.online) {
          setConnected();
        } else {
          // The stored address is stale or was never right — try to find the
          // real one automatically instead of leaving the user to type it in.
          chrome.runtime.sendMessage({ type: "DISCOVER_SERVER" }, (discovery) => {
            if (discovery && discovery.found) {
              currentServerUrl = discovery.serverUrl;
              serverUrlInput.value = currentServerUrl;
              setConnected();
            } else {
              setDisconnected();
            }
          });
        }
      }
    );
  }

  function setConnected() {
    isServerOnline = true;
    statusBadge.className = "status-pill connected";
    statusText.textContent = "Connected";
    offlineNotice.classList.add("hidden");
    btnSubmit.disabled = false;
  }

  function setDisconnected() {
    isServerOnline = false;
    statusBadge.className = "status-pill disconnected";
    statusText.textContent = "Offline";
    offlineNotice.classList.remove("hidden");
  }

  async function extractFromCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) return;

      if (tab.url) inputUrl.value = tab.url;

      btnReextract.disabled = true;
      btnReextract.innerHTML = `Scraping...`;

      // Step 1: Execute Layer 1 Content Script on-demand
      chrome.scripting.executeScript(
        {
          target: { tabId: tab.id },
          files: ["content/content-script.js"],
        },
        (results) => {
          btnReextract.disabled = false;
          btnReextract.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg><span>Re-scrape</span>`;

          let layer1Data = null;

          if (results && results[0] && results[0].result) {
            layer1Data = results[0].result;
          }

          if (!layer1Data) {
            chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_JOB_DETAILS" }, (response) => {
              if (response && response.success && response.data) {
                processExtractionPipeline(tab, response.data);
              }
            });
            return;
          }

          processExtractionPipeline(tab, layer1Data);
        }
      );
    } catch (err) {
      console.error("Tab extraction error:", err);
      btnReextract.disabled = false;
      btnReextract.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg><span>Re-scrape</span>`;
    }
  }

  function processExtractionPipeline(tab, layer1Data) {
    // --- LAYER 1: Instant Pre-fill (0ms wait) ---
    applyJobDataToForm(layer1Data);
    showExtractionBadge(`⚡ Layer 1: ${layer1Data.extraction_method || "DOM Extracted"}`, false);

    // --- LAYER 2 & 3: Background AI Parsing & Synthesis ---
    if (isServerOnline && layer1Data.clean_page_text) {
      showExtractionBadge("✨ Layer 2: AI Parsing...", false);

      chrome.runtime.sendMessage(
        {
          type: "PARSE_JOB_AI",
          payload: {
            url: tab.url,
            pageText: layer1Data.clean_page_text,
            layer1Data,
            firecrawlApiKey: currentFirecrawlKey,
          },
          serverUrl: currentServerUrl,
        },
        (aiResponse) => {
          if (aiResponse && aiResponse.success && aiResponse.aiParsedData) {
            const merged = synthesizeLayer3(layer1Data, aiResponse.aiParsedData);
            applyJobDataToForm(merged);
            showExtractionBadge(`✨ Layer 3 Synthesized (${aiResponse.provider || "AI"} + DOM)`, true);
            showToast("✨ AI enhanced job details!", "success");
          } else {
            showExtractionBadge(`⚡ Layer 1: ${layer1Data.extraction_method || "DOM Extracted"}`, false);
          }
        }
      );
    }
  }

  function synthesizeLayer3(layer1, layer2) {
    const title = (layer1.extraction_method?.includes("JSON-LD") || layer1.extraction_method?.includes("Platform"))
      ? (layer1.title || layer2.title)
      : (layer2.title || layer1.title);

    const company = (layer1.extraction_method?.includes("JSON-LD") || layer1.extraction_method?.includes("Platform"))
      ? (layer1.company || layer2.company)
      : (layer2.company || layer1.company);

    const location = layer2.location || layer1.location;
    const salary_range = layer1.salary_range || layer2.salary_range;
    const employment_type = layer2.employment_type || layer1.employment_type;
    const work_location = layer2.work_location || layer1.work_location;
    const description = (layer2.description && layer2.description.length > 50) ? layer2.description : layer1.description;

    const combinedSkills = Array.from(
      new Set([...(layer1.skills || []), ...(layer2.skills || [])])
    ).slice(0, 15);

    if (layer2.contact_name || layer2.contact_email) {
      activeContact = {
        contact_name: layer2.contact_name,
        contact_email: layer2.contact_email,
        contact_role: layer2.contact_role || "Recruiter",
      };
    }

    return {
      title,
      company,
      location,
      salary_range,
      employment_type,
      work_location,
      application_url: layer1.application_url,
      description,
      experience: layer1.experience,
      department: layer1.department,
      vacancy: layer1.vacancy,
      skills: combinedSkills,
    };
  }

  function applyJobDataToForm(data) {
    if (data.title && data.title !== "Job Position") inputTitle.value = data.title;
    if (data.company && data.company !== "Company Name") inputCompany.value = data.company;
    if (data.location) inputLocation.value = data.location;
    if (data.salary_range) inputSalary.value = data.salary_range;

    // Robust Normalized Select Matching
    setSelectValueNormalized(selectEmploymentType, data.employment_type);
    setSelectValueNormalized(selectWorkLocation, data.work_location);

    if (data.application_url) inputUrl.value = data.application_url;
    if (data.description) textareaDescription.value = data.description;
    if (Array.isArray(data.skills) && data.skills.length > 0) {
      activeSkills = data.skills;
      renderSkills();
    }

    renderExtraMetaChips(data);
  }

  function setSelectValueNormalized(selectEl, rawVal) {
    if (!rawVal || !selectEl) return;
    const rawClean = String(rawVal).toUpperCase().replace(/[^A-Z]/g, "");
    for (const opt of selectEl.options) {
      const optClean = opt.value.toUpperCase().replace(/[^A-Z]/g, "");
      if (rawClean === optClean || rawClean.includes(optClean) || optClean.includes(rawClean)) {
        selectEl.value = opt.value;
        return;
      }
    }
  }

  function renderExtraMetaChips(data) {
    extraMetaPills.innerHTML = "";
    const metaItems = [];
    if (data.experience) metaItems.push(`Exp: ${data.experience}`);
    if (data.department) metaItems.push(`Dept: ${data.department}`);
    if (data.vacancy) metaItems.push(`Vacancy: ${data.vacancy}`);
    if (activeContact?.contact_name) metaItems.push(`Recruiter: ${activeContact.contact_name}`);

    if (metaItems.length > 0) {
      metaItems.forEach((text) => {
        const chip = document.createElement("span");
        chip.className = "meta-chip";
        chip.textContent = text;
        extraMetaPills.appendChild(chip);
      });
      extraMetaPills.classList.remove("hidden");
    } else {
      extraMetaPills.classList.add("hidden");
    }
  }

  function showExtractionBadge(text, isAISynthesized) {
    extractionBadge.classList.remove("hidden");
    extractionText.textContent = text;
    if (isAISynthesized) {
      extractionBadge.className = "extraction-pill ai-synthesized";
    } else {
      extractionBadge.className = "extraction-pill";
    }
  }

  function renderSkills() {
    skillsTags.replaceChildren();
    activeSkills.forEach((skill, index) => {
      const tag = document.createElement("span");
      tag.className = "tag-chip";
      tag.textContent = `${skill} `;

      const removeBtn = document.createElement("span");
      removeBtn.className = "tag-remove";
      removeBtn.setAttribute("data-index", String(index));
      removeBtn.textContent = "×";

      tag.appendChild(removeBtn);
      skillsTags.appendChild(tag);
    });

    if (activeSkills.length > 0) {
      skillCounterBadge.textContent = activeSkills.length;
      skillCounterBadge.classList.remove("hidden");
    } else {
      skillCounterBadge.classList.add("hidden");
    }

    skillsTags.querySelectorAll(".tag-remove").forEach((el) => {
      el.addEventListener("click", (e) => {
        const idx = parseInt(e.target.getAttribute("data-index"), 10);
        activeSkills.splice(idx, 1);
        renderSkills();
      });
    });
  }

  function showToast(message, type = "info") {
    const toast = document.createElement("div");
    toast.className = `toast-item toast-${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(8px)";
      setTimeout(() => toast.remove(), 200);
    }, 2400);
  }

  async function handleFormSubmit(e) {
    e.preventDefault();

    const title = inputTitle.value.trim();
    const company = inputCompany.value.trim();
    if (!title || !company) {
      showToast("Job Title and Company are required", "error");
      return;
    }

    btnSubmit.disabled = true;
    btnSubmitText.textContent = "Saving...";

    const payload = {
      title,
      company,
      location: inputLocation.value.trim() || null,
      salary_range: inputSalary.value.trim() || null,
      work_location: selectWorkLocation.value || null,
      employment_type: selectEmploymentType.value || null,
      application_url: inputUrl.value.trim() || null,
      description: textareaDescription.value.trim() || null,
      skills: activeSkills,
      source: "Chrome Extension",
      ...(activeContact || {}),
    };

    chrome.runtime.sendMessage(
      {
        type: "ADD_JOB_TO_ATTRACK",
        jobData: payload,
        serverUrl: currentServerUrl,
      },
      (response) => {
        btnSubmit.disabled = false;
        btnSubmitText.textContent = "Save to Board";

        if (response && response.success) {
          jobForm.classList.add("hidden");
          successBanner.classList.remove("hidden");
          showToast("Saved to atTrack Wishlist! 🎉", "success");

          btnOpenBoard.addEventListener("click", () => {
            chrome.tabs.create({ url: `${currentServerUrl}/board` });
          });
        } else {
          showToast(`Failed to save: ${response?.error || "Unknown error"}`, "error");
        }
      }
    );
  }
});
