// atTrack Job Capture Extension - Minimal Apple/Hunter Style Popup Logic

document.addEventListener("DOMContentLoaded", () => {
  const statusBadge = document.getElementById("statusBadge");
  const statusText = document.getElementById("statusText");
  const btnToggleSettings = document.getElementById("btnToggleSettings");
  const settingsPanel = document.getElementById("settingsPanel");
  const serverUrlInput = document.getElementById("serverUrlInput");
  const btnSaveServerUrl = document.getElementById("btnSaveServerUrl");
  const offlineNotice = document.getElementById("offlineNotice");

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

  let currentServerUrl = "http://127.0.0.1:3308";
  let activeSkills = [];

  init();

  async function init() {
    // Load saved server URL
    chrome.runtime.sendMessage({ type: "GET_SERVER_URL" }, (response) => {
      if (response && response.serverUrl) {
        currentServerUrl = response.serverUrl;
        serverUrlInput.value = currentServerUrl;
      }
      checkStatus();
    });

    // Auto-extract job details from current active tab
    extractFromCurrentTab();

    // Event listeners
    btnToggleSettings.addEventListener("click", () => {
      settingsPanel.classList.toggle("hidden");
    });

    btnSaveServerUrl.addEventListener("click", () => {
      const newUrl = serverUrlInput.value.trim();
      if (newUrl) {
        currentServerUrl = newUrl;
        chrome.runtime.sendMessage({ type: "SET_SERVER_URL", serverUrl: newUrl }, () => {
          settingsPanel.classList.add("hidden");
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
          statusBadge.className = "status-pill connected";
          statusText.textContent = "Connected";
          offlineNotice.classList.add("hidden");
          btnSubmit.disabled = false;
        } else {
          statusBadge.className = "status-pill disconnected";
          statusText.textContent = "Offline";
          offlineNotice.classList.remove("hidden");
        }
      }
    );
  }

  async function extractFromCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) return;

      if (tab.url) inputUrl.value = tab.url;

      btnReextract.disabled = true;
      btnReextract.innerHTML = `Scraping...`;

      // Execute content-script on-demand and receive result directly
      chrome.scripting.executeScript(
        {
          target: { tabId: tab.id },
          files: ["content/content-script.js"],
        },
        (results) => {
          btnReextract.disabled = false;
          btnReextract.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg><span>Re-scrape</span>`;

          if (chrome.runtime.lastError) {
            console.warn("Script execution warning:", chrome.runtime.lastError.message);
            // Fallback to runtime message
            chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_JOB_DETAILS" }, (response) => {
              if (response && response.success && response.data) {
                handleExtractionResponse(response);
              }
            });
            return;
          }

          if (results && results[0] && results[0].result) {
            handleExtractionResponse({ success: true, data: results[0].result });
          }
        }
      );
    } catch (err) {
      console.error("Tab extraction error:", err);
      btnReextract.disabled = false;
      btnReextract.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg><span>Re-scrape</span>`;
    }
  }

  function handleExtractionResponse(response) {
    if (response && response.success && response.data) {
      const data = response.data;
      if (data.title) inputTitle.value = data.title;
      if (data.company) inputCompany.value = data.company;
      if (data.location) inputLocation.value = data.location;
      if (data.salary_range) inputSalary.value = data.salary_range;
      if (data.employment_type) selectEmploymentType.value = data.employment_type;
      if (data.work_location) selectWorkLocation.value = data.work_location;
      if (data.application_url) inputUrl.value = data.application_url;
      if (data.description) textareaDescription.value = data.description;
      if (Array.isArray(data.skills) && data.skills.length > 0) {
        activeSkills = data.skills;
        renderSkills();
      }
    }
  }

  function renderSkills() {
    skillsTags.innerHTML = "";
    activeSkills.forEach((skill, index) => {
      const tag = document.createElement("span");
      tag.className = "tag-chip";
      tag.innerHTML = `${skill} <span class="tag-remove" data-index="${index}">&times;</span>`;
      skillsTags.appendChild(tag);
    });

    skillsTags.querySelectorAll(".tag-remove").forEach((el) => {
      el.addEventListener("click", (e) => {
        const idx = parseInt(e.target.getAttribute("data-index"), 10);
        activeSkills.splice(idx, 1);
        renderSkills();
      });
    });
  }

  async function handleFormSubmit(e) {
    e.preventDefault();

    const title = inputTitle.value.trim();
    const company = inputCompany.value.trim();
    if (!title || !company) {
      alert("Job Title and Company Name are required.");
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

          btnOpenBoard.addEventListener("click", () => {
            chrome.tabs.create({ url: `${currentServerUrl}/board` });
          });
        } else {
          alert(`Failed to save job: ${response?.error || "Unknown error"}`);
        }
      }
    );
  }
});
