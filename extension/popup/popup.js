// atTrack Job Capture — Gradient Tabs Edition
// Tabs: Capture | AI Add | Settings — strict connection + manual AI

document.addEventListener("DOMContentLoaded", () => {
  // Notify active tab that side panel is open/closed
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, { type: "SIDE_PANEL_OPENED" }).catch(() => {});
    }
  });

  window.addEventListener("pagehide", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "SIDE_PANEL_CLOSED" }).catch(() => {});
      }
    });
  });

  // Header status
  const statusBadge = document.getElementById("statusBadge");
  const statusText = document.getElementById("statusText");

  // Tabs
  const tabCapture = document.getElementById("tabCapture");
  const tabManual = document.getElementById("tabManual");
  const tabSettings = document.getElementById("tabSettings");
  const panelCapture = document.getElementById("panelCapture");
  const panelManual = document.getElementById("panelManual");
  const panelSettings = document.getElementById("panelSettings");
  const allTabs = [tabCapture, tabManual, tabSettings];
  const allPanels = [panelCapture, panelManual, panelSettings];

  // Capture elements
  const serverUrlInput = document.getElementById("serverUrlInput");
  const btnSaveServerUrl = document.getElementById("btnSaveServerUrl");
  const offlineNotice = document.getElementById("offlineNotice");
  const pendingQueueNotice = document.getElementById("pendingQueueNotice");
  const pendingQueueText = document.getElementById("pendingQueueText");
  const btnSyncNow = document.getElementById("btnSyncNow");
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
  const successTitle = document.getElementById("successTitle");
  const successSubtitle = document.getElementById("successSubtitle");
  const btnOpenBoard = document.getElementById("btnOpenBoard");
  const firecrawlKeyInput = document.getElementById("firecrawlKeyInput");
  const secretInput = document.getElementById("secretInput");
  const btnAutoDetect = document.getElementById("btnAutoDetect");
  const toggleOnPagePrompt = document.getElementById("toggleOnPagePrompt");

  // Settings strict elements
  const settingsStatusDot = document.getElementById("settingsStatusDot");
  const settingsStatusTitle = document.getElementById("settingsStatusTitle");
  const settingsStatusSubtitle = document.getElementById("settingsStatusSubtitle");
  const settingsServerUrl = document.getElementById("settingsServerUrl");
  const settingsSecretState = document.getElementById("settingsSecretState");
  const settingsQueueCount = document.getElementById("settingsQueueCount");
  const settingsLastSync = document.getElementById("settingsLastSync");
  const btnSettingsSync = document.getElementById("btnSettingsSync");
  const btnSettingsSyncText = document.getElementById("btnSettingsSyncText");

  // Manual AI elements
  const manualUrlInput = document.getElementById("manualUrlInput");
  const manualTextInput = document.getElementById("manualTextInput");
  const manualImageDrop = document.getElementById("manualImageDrop");
  const manualImageInput = document.getElementById("manualImageInput");
  const manualBrowseBtn = document.getElementById("manualBrowseBtn");
  const manualImagePreview = document.getElementById("manualImagePreview");
  const manualAiStatus = document.getElementById("manualAiStatus");
  const manualAiStatusText = document.getElementById("manualAiStatusText");
  const manualAiResult = document.getElementById("manualAiResult");
  const manualAiSummary = document.getElementById("manualAiSummary");
  const btnManualExtract = document.getElementById("btnManualExtract");
  const btnManualExtractText = document.getElementById("btnManualExtractText");
  const btnManualClear = document.getElementById("btnManualClear");

  let currentServerUrl = "http://127.0.0.1:3788";
  let currentFirecrawlKey = "";
  let activeSkills = [];
  let activeContact = null;
  let isServerOnline = false;
  let lastSyncAt = null;
  let manualImages = []; // { id, dataUrl }

  init();

  async function init() {
    // Load saved URL/key/secret
    chrome.runtime.sendMessage({ type: "GET_SERVER_URL" }, (response) => {
      if (response && response.serverUrl) {
        currentServerUrl = response.serverUrl;
        if (serverUrlInput) serverUrlInput.value = currentServerUrl;
      }
      // Strict check on open — no auto-discover fallback
      checkStatusStrict();
      refreshPendingBadge();
      updateSettingsMeta();
    });
    loadStoredCredentials();
    initTabs();
    extractFromCurrentTab();
    initManualHandlers();
    setupAutoSaveInputs();

    // In side panel mode, listen to tab switches to auto-extract active tab
    if (chrome.tabs?.onActivated) {
      chrome.tabs.onActivated.addListener(() => {
        const activePanel = document.querySelector("#panelCapture.active");
        if (activePanel) {
          extractFromCurrentTab();
        }
      });
    }

    // Queue sync
    if (btnSyncNow) {
      btnSyncNow.addEventListener("click", () => {
        btnSyncNow.disabled = true;
        btnSyncNow.textContent = "Syncing…";
        chrome.runtime.sendMessage({ type: "FLUSH_PENDING_JOBS" }, (res) => {
          btnSyncNow.disabled = false;
          btnSyncNow.textContent = "Sync now";
          if (res && res.flushed > 0) showToast(`Synced ${res.flushed} queued job${res.flushed === 1 ? "" : "s"}`, "success");
          refreshPendingBadge();
          updateSettingsMeta();
        });
      });
    }

    // Strict Sync Now in Settings
    if (btnSettingsSync) {
      btnSettingsSync.addEventListener("click", handleStrictSync);
    }

    if (btnAutoDetect) {
      btnAutoDetect.addEventListener("click", () => {
        btnAutoDetect.disabled = true;
        btnAutoDetect.textContent = "Scanning...";
        chrome.runtime.sendMessage({ type: "DISCOVER_SERVER" }, (discovery) => {
          btnAutoDetect.disabled = false;
          btnAutoDetect.textContent = "Auto-Detect Port Ladder";
          if (discovery && discovery.found) {
            currentServerUrl = discovery.serverUrl;
            if (serverUrlInput) serverUrlInput.value = currentServerUrl;
            showToast(`Found: ${currentServerUrl}`, "success");
            // Strict check the discovered URL
            checkStatusStrict();
            updateSettingsMeta();
          } else {
            showToast("No active BetterJob instance found", "error");
            setDisconnectedStrict("Offline — not connected", "No instance on 3788–3792, 3000, 5173, 8080");
          }
        });
      });
    }

    if (btnSaveServerUrl) {
      btnSaveServerUrl.addEventListener("click", () => {
        const newUrl = serverUrlInput ? serverUrlInput.value.trim() : "";
        const newFcKey = firecrawlKeyInput ? firecrawlKeyInput.value.trim() : "";
        const newSecret = secretInput ? secretInput.value.trim() : "";
        // Even with auto-save, explicit Save & Sync gives clear feedback and forces immediate sync
        if (newUrl) currentServerUrl = newUrl;
        currentFirecrawlKey = newFcKey;
        chrome.storage.local.set({ firecrawlApiKey: newFcKey, authSecret: newSecret, serverUrl: newUrl || currentServerUrl }, () => {
          if (newUrl) chrome.runtime.sendMessage({ type: "SET_SERVER_URL", serverUrl: newUrl }, () => {});
          updateSettingsMeta();
          showToast("Saved & syncing…", "info");
          // Small pulse on save states
          const ss = document.getElementById("secretSaveState");
          const fs = document.getElementById("firecrawlSaveState");
          const us = document.getElementById("serverUrlSaveState");
          [ss, fs, us].forEach((el) => { if (el) { el.textContent = "Saved ✓"; el.className = "field-save-state saved"; } });
          handleStrictSync();
        });
      });
    }

    if (btnToggleMore) {
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
    }

    if (btnReextract) {
      btnReextract.addEventListener("click", (e) => {
        e.preventDefault();
        extractFromCurrentTab();
      });
    }

    if (inputSkills) {
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
    }

    if (jobForm) jobForm.addEventListener("submit", handleFormSubmit);
  }

  function initTabs() {
    function switchTab(name) {
      allTabs.forEach((t) => {
        const isActive = t && t.dataset.tab === name;
        if (!t) return;
        t.classList.toggle("active", isActive);
        t.setAttribute("aria-selected", String(isActive));
      });
      allPanels.forEach((p) => {
        if (!p) return;
        const shouldShow = p.id === `panel${name.charAt(0).toUpperCase() + name.slice(1)}`;
        p.classList.toggle("active", shouldShow);
        p.classList.toggle("hidden", !shouldShow);
      });
      chrome.storage.local.set({ popupActiveTab: name });
    }
    allTabs.forEach((tab) => {
      if (!tab) return;
      tab.addEventListener("click", () => switchTab(tab.dataset.tab));
    });
    // Restore last tab
    chrome.storage.local.get(["popupActiveTab"], (res) => {
      const saved = res.popupActiveTab;
      if (saved && ["capture", "manual", "settings"].includes(saved)) switchTab(saved);
      else switchTab("capture");
    });
    // Make panels visible after init to avoid flash
    allPanels.forEach((p) => { if (p) p.classList.remove("hidden"); });
  }

  function initManualHandlers() {
    if (manualBrowseBtn && manualImageInput) {
      manualBrowseBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        manualImageInput.click();
      });
    }
    if (manualImageInput) {
      manualImageInput.addEventListener("change", (e) => {
        const files = Array.from(e.target.files || []);
        addManualImages(files);
        e.target.value = "";
      });
    }
    if (manualImageDrop) {
      manualImageDrop.addEventListener("click", () => {
        if (manualImageInput) manualImageInput.click();
      });
      manualImageDrop.addEventListener("dragover", (e) => {
        e.preventDefault();
        manualImageDrop.classList.add("drag-over");
      });
      manualImageDrop.addEventListener("dragleave", () => manualImageDrop.classList.remove("drag-over"));
      manualImageDrop.addEventListener("drop", (e) => {
        e.preventDefault();
        manualImageDrop.classList.remove("drag-over");
        const files = Array.from(e.dataTransfer.files || []).filter((f) => f.type.startsWith("image/"));
        addManualImages(files);
      });
      // Paste
      manualImageDrop.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "v") { /* handled globally */ }
      });
    }
    // Global paste for images
    document.addEventListener("paste", (e) => {
      const activePanel = document.querySelector("#panelManual.active");
      if (!activePanel) return;
      const items = Array.from(e.clipboardData?.items || []);
      const imageFiles = items.filter((it) => it.type.startsWith("image/")).map((it) => it.getAsFile()).filter(Boolean);
      if (imageFiles.length > 0) {
        e.preventDefault();
        addManualImages(imageFiles);
        showToast(`Added ${imageFiles.length} image(s) from clipboard`, "info");
      }
    });
    // Also paste into text area should not be intercepted when focused elsewhere — above already handles

    if (btnManualExtract) {
      btnManualExtract.addEventListener("click", handleManualExtract);
    }
    if (btnManualClear) {
      btnManualClear.addEventListener("click", () => {
        if (manualUrlInput) manualUrlInput.value = "";
        if (manualTextInput) manualTextInput.value = "";
        manualImages = [];
        renderManualImages();
        if (manualAiResult) manualAiResult.classList.add("hidden");
        if (manualAiStatus) manualAiStatus.classList.add("hidden");
      });
    }
  }

  function setupAutoSaveInputs() {
    const secretSaveState = document.getElementById("secretSaveState");
    const firecrawlSaveState = document.getElementById("firecrawlSaveState");
    const serverUrlSaveState = document.getElementById("serverUrlSaveState");
    let secretTimer = null, firecrawlTimer = null, serverUrlTimer = null;

    function showState(el, text, cls) {
      if (!el) return;
      el.textContent = text;
      el.className = "field-save-state" + (cls ? " " + cls : "");
      if (cls === "saved") {
        setTimeout(() => { if (el) { el.textContent = el.id === "secretSaveState" ? "Paste → auto-saves" : "Auto-saves"; el.className = "field-save-state"; } }, 2200);
      }
    }

    function saveAll() {
      const newUrl = serverUrlInput ? serverUrlInput.value.trim() : "";
      const newFcKey = firecrawlKeyInput ? firecrawlKeyInput.value.trim() : "";
      const newSecret = secretInput ? secretInput.value.trim() : "";
      if (newUrl) currentServerUrl = newUrl;
      currentFirecrawlKey = newFcKey;
      chrome.storage.local.set({ firecrawlApiKey: newFcKey, authSecret: newSecret, serverUrl: newUrl || currentServerUrl });
      if (newUrl) chrome.runtime.sendMessage({ type: "SET_SERVER_URL", serverUrl: newUrl }, () => {});
      updateSettingsMeta();
    }

    if (secretInput) {
      secretInput.addEventListener("input", () => {
        showState(secretSaveState, "Saving…", "saving");
        if (secretInput) secretInput.classList.remove("input-saved");
        clearTimeout(secretTimer);
        secretTimer = setTimeout(() => {
          saveAll();
          showState(secretSaveState, "Saved ✓", "saved");
          if (secretInput) { secretInput.classList.add("input-saved"); setTimeout(() => secretInput.classList.remove("input-saved"), 1500); }
        }, 450);
      });
      secretInput.addEventListener("paste", () => {
        setTimeout(() => {
          // Trigger input handler after paste
          secretInput.dispatchEvent(new Event("input", { bubbles: true }));
          showToast("Secret pasted — auto-saved", "success");
        }, 80);
      });
    }
    if (firecrawlKeyInput) {
      firecrawlKeyInput.addEventListener("input", () => {
        showState(firecrawlSaveState, "Saving…", "saving");
        clearTimeout(firecrawlTimer);
        firecrawlTimer = setTimeout(() => {
          saveAll();
          showState(firecrawlSaveState, "Saved ✓", "saved");
        }, 500);
      });
    }
    if (serverUrlInput) {
      serverUrlInput.addEventListener("input", () => {
        showState(serverUrlSaveState, "Saving…", "saving");
        clearTimeout(serverUrlTimer);
        serverUrlTimer = setTimeout(() => {
          saveAll();
          showState(serverUrlSaveState, "Saved ✓", "saved");
        }, 500);
      });
    }
  }

  function addManualImages(files) {
    const remaining = 3 - manualImages.length;
    const toAdd = files.slice(0, remaining);
    if (files.length > remaining) showToast(`Only 3 images allowed — added first ${remaining}`, "warning");
    if (toAdd.length === 0) return;
    let pending = toAdd.length;
    toAdd.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        manualImages.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, dataUrl: reader.result, name: file.name });
        pending--;
        if (pending === 0) renderManualImages();
      };
      reader.readAsDataURL(file);
    });
  }

  function renderManualImages() {
    if (!manualImagePreview) return;
    if (manualImages.length === 0) {
      manualImagePreview.classList.add("hidden");
      manualImagePreview.innerHTML = "";
      return;
    }
    manualImagePreview.classList.remove("hidden");
    manualImagePreview.innerHTML = "";
    manualImages.forEach((img) => {
      const div = document.createElement("div");
      div.className = "image-thumb";
      const image = document.createElement("img");
      image.src = img.dataUrl;
      image.alt = img.name || "upload";
      const rm = document.createElement("button");
      rm.type = "button";
      rm.className = "image-thumb-remove";
      rm.textContent = "×";
      rm.title = "Remove";
      rm.addEventListener("click", () => {
        manualImages = manualImages.filter((x) => x.id !== img.id);
        renderManualImages();
      });
      div.appendChild(image);
      div.appendChild(rm);
      manualImagePreview.appendChild(div);
    });
  }

  async function handleManualExtract() {
    const url = manualUrlInput ? manualUrlInput.value.trim() : "";
    const text = manualTextInput ? manualTextInput.value.trim() : "";
    if (!url && !text && manualImages.length === 0) {
      showToast("Add a link, text, or image to extract", "warning");
      return;
    }
    if (!isServerOnline) {
      showToast("BetterJob offline — launch app and Sync first", "error");
      switchToTab("settings");
      return;
    }
    // Fire-and-forget: send to server queue, show immediate confirmation (no long wait)
    if (manualAiStatus) manualAiStatus.classList.remove("hidden");
    if (manualAiStatusText) manualAiStatusText.textContent = "Sending to server…";
    if (manualAiResult) manualAiResult.classList.add("hidden");
    if (btnManualExtract) btnManualExtract.disabled = true;
    if (btnManualExtractText) btnManualExtractText.textContent = "Sending…";

    const imagesBase64 = manualImages.map((m) => m.dataUrl);

    const tryManual = () => new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: "PARSE_MANUAL_AI",
        payload: { url, text, images: imagesBase64, firecrawlApiKey: currentFirecrawlKey },
        serverUrl: currentServerUrl,
      }, (res) => resolve(res));
    });

    const fallbackParse = () => new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: "PARSE_JOB_AI",
        payload: { url, pageText: text, layer1Data: { title: "", company: "" }, firecrawlApiKey: currentFirecrawlKey },
        serverUrl: currentServerUrl,
      }, (res) => resolve(res));
    });

    let aiResponse = await tryManual();
    if (!aiResponse || aiResponse.error === "Unknown message type" || aiResponse.reason === "NO_ENDPOINT") {
      aiResponse = await fallbackParse();
    }

    if (manualAiStatus) manualAiStatus.classList.add("hidden");
    if (btnManualExtract) btnManualExtract.disabled = false;
    if (btnManualExtractText) btnManualExtractText.textContent = "Extract with AI";

    // Queued path — instant confirmation, server will enrich in background
    if (aiResponse && aiResponse.success && aiResponse.queued) {
      const title = aiResponse.placeholderTitle || url || "Job";
      if (manualAiResult) manualAiResult.classList.remove("hidden");
      if (manualAiSummary) manualAiSummary.textContent = `Queued: "${title}" — server confirmed. It will appear on your board and AI will fill details shortly.`;
      // Make result look like queued success (green)
      if (manualAiResult) {
        manualAiResult.innerHTML = `<div class="success-card small"><div class="flex-center gap-4"><span class="status-dot success"></span><span class="text-sm font-medium">Sent to server — queued</span></div><p id="manualAiSummary" class="text-xs text-muted">${manualAiSummary ? manualAiSummary.textContent : ""}</p><p class="text-xs text-subtle" style="margin-top:4px;">Job ID: ${aiResponse.jobId || "—"} — no need to wait, you can close this popup.</p></div>`;
      }
      showToast(`Sent to server — queued (${title})`, "success");
      // Clear the form for next add, but keep URL if it was current tab? Clear all for clarity
      // Leave URL, clear text/images after successful queue so user can add another
      if (manualTextInput) manualTextInput.value = "";
      manualImages = [];
      renderManualImages();
      return;
    }

    // Legacy synchronous path (if server returned immediate aiParsedData) — keep for compat
    if (aiResponse && aiResponse.success && aiResponse.aiParsedData) {
      const data = aiResponse.aiParsedData;
      const merged = {
        title: data.title || "",
        company: data.company || "",
        location: data.location || "",
        salary_range: data.salary_range || "",
        employment_type: data.employment_type || "",
        work_location: data.work_location || "",
        description: data.description || text || "",
        skills: Array.isArray(data.skills) ? data.skills : [],
        application_url: url || data.application_url || "",
        experience: data.experience || null,
        department: data.department || null,
        vacancy: data.vacancy || null,
        benefits: Array.isArray(data.benefits) ? data.benefits : [],
        contact_name: data.contact_name || null,
        contact_email: data.contact_email || null,
      };
      if (data.contact_name || data.contact_email) {
        activeContact = { contact_name: data.contact_name, contact_email: data.contact_email, contact_role: data.contact_role || "Recruiter" };
      }
      applyJobDataToForm(merged);
      if (manualAiResult) manualAiResult.classList.remove("hidden");
      if (manualAiSummary) {
        const prov = aiResponse.provider || "AI";
        manualAiSummary.textContent = `${prov}: ${merged.title || "Job"} @ ${merged.company || "Company"} — ${merged.skills?.slice(0, 5).join(", ") || "skills extracted"}`;
      }
      showExtractionBadge(`✨ AI Manual (${aiResponse.provider || "AI"})`, true);
      showToast("✨ AI precalculation done — review Capture tab and Save", "success");
      switchToTab("capture");
    } else {
      const err = aiResponse?.error || aiResponse?.message || "AI extraction failed";
      showToast(err, "error");
      if (manualAiResult) manualAiResult.classList.add("hidden");
    }
  }

  function switchToTab(name) {
    const tab = document.getElementById(`tab${name.charAt(0).toUpperCase() + name.slice(1)}`);
    if (tab) tab.click();
  }

  function loadStoredCredentials() {
    chrome.storage.local.get(["firecrawlApiKey", "authSecret", "serverUrl", "lastSyncAt", "onPagePromptEnabled"], (res) => {
      if (res) {
        if (res.firecrawlApiKey && firecrawlKeyInput) {
          currentFirecrawlKey = res.firecrawlApiKey;
          firecrawlKeyInput.value = currentFirecrawlKey;
        }
        if (res.authSecret && secretInput) secretInput.value = res.authSecret;
        if (res.serverUrl && serverUrlInput) {
          currentServerUrl = res.serverUrl;
          serverUrlInput.value = res.serverUrl;
        }
        if (res.lastSyncAt) lastSyncAt = res.lastSyncAt;
        if (toggleOnPagePrompt) {
          toggleOnPagePrompt.checked = res.onPagePromptEnabled !== false;
        }
        updateSettingsMeta();
      }
    });

    if (toggleOnPagePrompt) {
      toggleOnPagePrompt.addEventListener("change", () => {
        chrome.storage.local.set({ onPagePromptEnabled: toggleOnPagePrompt.checked }, () => {
          showToast(toggleOnPagePrompt.checked ? "On-page prompts enabled" : "On-page prompts disabled", "info");
        });
      });
    }
  }

  function refreshPendingBadge() {
    chrome.runtime.sendMessage({ type: "GET_PENDING_COUNT" }, (res) => {
      const count = res && typeof res.count === "number" ? res.count : 0;
      if (count > 0) {
        if (pendingQueueText) pendingQueueText.textContent = `${count} job${count === 1 ? "" : "s"} queued — will sync automatically`;
        if (pendingQueueNotice) pendingQueueNotice.classList.remove("hidden");
      } else {
        if (pendingQueueNotice) pendingQueueNotice.classList.add("hidden");
      }
      if (settingsQueueCount) settingsQueueCount.textContent = String(count);
    });
  }

  function updateSettingsMeta() {
    if (settingsServerUrl) settingsServerUrl.textContent = currentServerUrl || "—";
    chrome.storage.local.get(["authSecret"], (res) => {
      if (settingsSecretState) {
        const has = !!(res && res.authSecret && String(res.authSecret).trim());
        settingsSecretState.textContent = has ? "●●●● set" : "Not set — paste or Sync";
        settingsSecretState.style.color = has ? "var(--success)" : "var(--warning)";
      }
    });
    if (settingsLastSync) {
      if (lastSyncAt) {
        const d = new Date(lastSyncAt);
        settingsLastSync.textContent = `Last sync ${d.toLocaleTimeString()}`;
      } else {
        settingsLastSync.textContent = "Never synced";
      }
    }
  }

  // Strict status — no auto-discover on failure
  function checkStatusStrict() {
    if (statusBadge) statusBadge.className = "status-pill checking";
    if (statusText) statusText.textContent = "Checking";
    if (offlineNotice) offlineNotice.classList.add("hidden");
    setSettingsChecking();

    chrome.runtime.sendMessage(
      { type: "CHECK_SERVER_STATUS", serverUrl: currentServerUrl },
      (response) => {
        if (response && response.online) {
          setConnectedStrict(response.serverUrl || currentServerUrl);
        } else {
          setDisconnectedStrict("Offline — not connected", response?.error || "App not responding on this port. Click Sync Now.");
        }
      }
    );
  }

  async function handleStrictSync() {
    if (!btnSettingsSync) return;
    // Flush any pending auto-save (user may have just pasted and hit Sync before debounce fired)
    try {
      const pendingUrl = serverUrlInput ? serverUrlInput.value.trim() : "";
      const pendingFc = firecrawlKeyInput ? firecrawlKeyInput.value.trim() : "";
      const pendingSecret = secretInput ? secretInput.value.trim() : "";
      if (pendingUrl) currentServerUrl = pendingUrl;
      currentFirecrawlKey = pendingFc || currentFirecrawlKey;
      chrome.storage.local.set({ serverUrl: pendingUrl || currentServerUrl, firecrawlApiKey: pendingFc, authSecret: pendingSecret });
      if (pendingUrl) chrome.runtime.sendMessage({ type: "SET_SERVER_URL", serverUrl: pendingUrl }, () => {});
    } catch {}
    btnSettingsSync.disabled = true;
    const oldText = btnSettingsSyncText ? btnSettingsSyncText.textContent : "";
    if (btnSettingsSyncText) btnSettingsSyncText.textContent = "Syncing...";
    if (statusBadge) statusBadge.className = "status-pill syncing";
    if (statusText) statusText.textContent = "Syncing";
    setSettingsSyncing();

    // 1) Strict probe current URL first
    const probe = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "CHECK_SERVER_STATUS", serverUrl: currentServerUrl }, (r) => resolve(r));
    });

    if (probe && probe.online) {
      const url = probe.serverUrl || currentServerUrl;
      currentServerUrl = url;
      if (serverUrlInput) serverUrlInput.value = url;
      lastSyncAt = Date.now();
      chrome.storage.local.set({ serverUrl: url, lastSyncAt });
      // Try to pull secret from open app tab via bridge if present
      await tryBridgeSync();
      setConnectedStrict(url);
      showToast(`Synced — Connected to ${url}`, "success");
      // Flush queued
      chrome.runtime.sendMessage({ type: "FLUSH_PENDING_JOBS" }, () => refreshPendingBadge());
      btnSettingsSync.disabled = false;
      if (btnSettingsSyncText) btnSettingsSyncText.textContent = oldText || "Sync Now";
      updateSettingsMeta();
      return;
    }

    // 2) Probe failed — run full discovery (tabs + ladder)
    chrome.runtime.sendMessage({ type: "DISCOVER_SERVER" }, async (discovery) => {
      if (discovery && discovery.found) {
        currentServerUrl = discovery.serverUrl;
        if (serverUrlInput) serverUrlInput.value = currentServerUrl;
        lastSyncAt = Date.now();
        chrome.storage.local.set({ serverUrl: currentServerUrl, lastSyncAt });
        await tryBridgeSync();
        setConnectedStrict(currentServerUrl);
        showToast(`Synced — Found at ${currentServerUrl}`, "success");
        chrome.runtime.sendMessage({ type: "FLUSH_PENDING_JOBS" }, () => refreshPendingBadge());
      } else {
        setDisconnectedStrict("Offline — not connected", "No app found. Launch desktop app and try Sync again.");
        showToast("Not connected — launch BetterJob app", "error");
      }
      btnSettingsSync.disabled = false;
      if (btnSettingsSyncText) btnSettingsSyncText.textContent = oldText || "Sync Now";
      updateSettingsMeta();
    });
  }

  async function tryBridgeSync() {
    // If an atTrack tab is open, it will have posted ATTRACK_EXTENSION_PRESENT and the bridge can push SYNC_CONFIG
    // We also proactively ask service worker if it has recently received a bridge push — no-op if not.
    // This keeps the flow instant when app is on: popup Sync → probe → connected + secret auto-pulled if app tab exists.
    return new Promise((resolve) => {
      // No direct bridge query; the SYNC_CONFIG push happens automatically when app tab loads.
      // We just refresh stored secret display.
      setTimeout(() => { loadStoredCredentials(); resolve(); }, 300);
    });
  }

  function setSettingsChecking() {
    isServerOnline = false;
    if (settingsStatusDot) settingsStatusDot.className = "status-dot large";
    if (settingsStatusTitle) settingsStatusTitle.textContent = "Checking...";
    if (settingsStatusSubtitle) settingsStatusSubtitle.textContent = "Probing local BetterJob instance";
  }
  function setSettingsSyncing() {
    isServerOnline = false;
    if (settingsStatusDot) settingsStatusDot.className = "status-dot large";
    if (settingsStatusDot) settingsStatusDot.style.background = "var(--primary)";
    if (settingsStatusTitle) settingsStatusTitle.textContent = "Syncing...";
    if (settingsStatusSubtitle) settingsStatusSubtitle.textContent = "Re-probing ports and syncing key";
    if (settingsStatusDot) settingsStatusDot.style.animation = "pulse 900ms infinite alternate";
  }
  function setConnectedStrict(url) {
    isServerOnline = true;
    if (statusBadge) statusBadge.className = "status-pill connected";
    if (statusText) statusText.textContent = "Connected";
    if (offlineNotice) offlineNotice.classList.add("hidden");
    if (btnSubmit) btnSubmit.disabled = false;
    if (settingsStatusDot) { settingsStatusDot.className = "status-dot large success"; settingsStatusDot.style.animation = ""; }
    if (settingsStatusTitle) settingsStatusTitle.textContent = "Connected";
    if (settingsStatusSubtitle) settingsStatusSubtitle.textContent = url;
    lastSyncAt = Date.now();
    chrome.storage.local.set({ lastSyncAt });
    updateSettingsMeta();
    refreshPendingBadge();
  }
  function setDisconnectedStrict(title, subtitle) {
    isServerOnline = false;
    if (statusBadge) statusBadge.className = "status-pill disconnected";
    if (statusText) statusText.textContent = "Offline";
    if (offlineNotice) offlineNotice.classList.remove("hidden");
    if (btnSubmit) btnSubmit.disabled = true;
    if (settingsStatusDot) { settingsStatusDot.className = "status-dot large"; settingsStatusDot.style.background = "var(--destructive)"; settingsStatusDot.style.animation = ""; }
    if (settingsStatusTitle) settingsStatusTitle.textContent = title || "Offline";
    if (settingsStatusSubtitle) settingsStatusSubtitle.textContent = subtitle || "Not connected — click Sync Now";
    refreshPendingBadge();
    updateSettingsMeta();
  }

  async function extractFromCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) return;
      if (tab.url && inputUrl) inputUrl.value = tab.url;
      if (manualUrlInput && !manualUrlInput.value && tab.url) manualUrlInput.value = tab.url;

      if (btnReextract) {
        btnReextract.disabled = true;
        btnReextract.innerHTML = `Scraping...`;
      }
      chrome.scripting.executeScript(
        { target: { tabId: tab.id }, files: ["content/content-script.js"] },
        (results) => {
          if (btnReextract) {
            btnReextract.disabled = false;
            btnReextract.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg><span>Re-scrape</span>`;
          }
          let layer1Data = null;
          if (results && results[0] && results[0].result) layer1Data = results[0].result;
          if (!layer1Data) {
            chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_JOB_DETAILS" }, (response) => {
              if (response && response.success && response.data) processExtractionPipeline(tab, response.data);
            });
            return;
          }
          processExtractionPipeline(tab, layer1Data);
        }
      );
    } catch (err) {
      console.error("Tab extraction error:", err);
      if (btnReextract) {
        btnReextract.disabled = false;
        btnReextract.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg><span>Re-scrape</span>`;
      }
    }
  }

  function processExtractionPipeline(tab, layer1Data) {
    applyJobDataToForm(layer1Data);
    showExtractionBadge(`\u26A1 Layer 1: ${layer1Data.extraction_method || "DOM Heuristic"}`, false);
    // Deep AI scrape now sends HTML snapshot + full text + carrier signals — not just truncated text
    const hasDeepPayload = Boolean(layer1Data.clean_page_text || layer1Data.html_snapshot || layer1Data.full_page_text);
    if (isServerOnline && hasDeepPayload) {
      showExtractionBadge("\u2728 Deep AI Scraping...", false);
      chrome.runtime.sendMessage(
        {
          type: "PARSE_JOB_AI",
          payload: {
            url: tab.url,
            pageText: layer1Data.clean_page_text || "",
            fullPageText: layer1Data.full_page_text || "",
            html: layer1Data.html_snapshot || "",
            layer1Data,
            firecrawlApiKey: currentFirecrawlKey,
            isCarrierPage: layer1Data.is_carrier_page || false,
            carrierMeta: layer1Data.carrier_meta || null,
          },
          serverUrl: currentServerUrl,
        },
        (aiResponse) => {
          if (aiResponse && aiResponse.success && aiResponse.aiParsedData) {
            const merged = synthesizeLayer3(layer1Data, aiResponse.aiParsedData);
            applyJobDataToForm(merged);
            showExtractionBadge(`\u2728 Layer 3 Synthesized (${aiResponse.provider || "AI"} + DOM)`, true);
            showToast("\u2728 AI enhanced job details!", "success");
          } else {
            showExtractionBadge(`\u26A1 Layer 1: ${layer1Data.extraction_method || "DOM Heuristic"}`, false);
          }
        }
      );
    }
  }

  function synthesizeLayer3(layer1, layer2) {
    const isCarrier = Boolean(layer1.is_carrier_page);
    // For carrier pages, AI deep scrape is more accurate than heuristic — prioritize AI for salary/dept/vacancy
    const title = (layer1.extraction_method?.includes("JSON-LD") || layer1.extraction_method?.includes("Platform") && !isCarrier) ? (layer1.title || layer2.title) : (layer2.title || layer1.title);
    const company = (layer1.extraction_method?.includes("JSON-LD") || layer1.extraction_method?.includes("Platform") && !isCarrier) ? (layer1.company || layer2.company) : (layer2.company || layer1.company);
    const location = layer2.location || layer1.location;
    const salary_range = isCarrier ? (layer2.salary_range || layer1.salary_range) : (layer1.salary_range || layer2.salary_range);
    const employment_type = layer2.employment_type || layer1.employment_type;
    const work_location = layer2.work_location || layer1.work_location;
    const description = (layer2.description && layer2.description.length > 50) ? layer2.description : layer1.description;
    const experience = layer2.experience || layer1.experience;
    const department = layer2.department || layer1.department;
    const vacancy = layer2.vacancy || layer1.vacancy;
    const combinedSkills = Array.from(new Set([...(layer1.skills || []), ...(layer2.skills || [])])).slice(0, 20);
    if (layer2.contact_name || layer2.contact_email) {
      activeContact = { contact_name: layer2.contact_name, contact_email: layer2.contact_email, contact_role: layer2.contact_role || "Recruiter" };
    }
    return { title, company, location, salary_range, employment_type, work_location, application_url: layer1.application_url, description, experience, department, vacancy, skills: combinedSkills };
  }

  function applyJobDataToForm(data) {
    if (data.title && data.title !== "Job Position" && inputTitle) inputTitle.value = data.title;
    if (data.company && data.company !== "Company Name" && inputCompany) inputCompany.value = data.company;
    if (data.location && inputLocation) inputLocation.value = data.location;
    if (data.salary_range && inputSalary) inputSalary.value = data.salary_range;
    setSelectValueNormalized(selectEmploymentType, data.employment_type);
    setSelectValueNormalized(selectWorkLocation, data.work_location);
    if (data.application_url && inputUrl) inputUrl.value = data.application_url;
    if (data.description && textareaDescription) textareaDescription.value = data.description;
    if (Array.isArray(data.skills) && data.skills.length > 0) { activeSkills = data.skills; renderSkills(); }
    renderExtraMetaChips(data);
    if (moreDetailsSection) moreDetailsSection.classList.remove("hidden");
    if (btnToggleMore) btnToggleMore.textContent = "Hide Details";
  }

  function setSelectValueNormalized(selectEl, rawVal) {
    if (!rawVal || !selectEl) return;
    const rawClean = String(rawVal).toUpperCase().replace(/[^A-Z]/g, "");
    for (const opt of selectEl.options) {
      const optClean = opt.value.toUpperCase().replace(/[^A-Z]/g, "");
      if (rawClean === optClean || rawClean.includes(optClean) || optClean.includes(rawClean)) { selectEl.value = opt.value; return; }
    }
  }

  function renderExtraMetaChips(data) {
    if (!extraMetaPills) return;
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
    if (!extractionBadge || !extractionText) return;
    extractionBadge.classList.remove("hidden");
    extractionText.textContent = text;
    extractionBadge.className = isAISynthesized ? "extraction-pill ai-synthesized" : "extraction-pill";
  }

  function renderSkills() {
    if (!skillsTags) return;
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
    if (skillCounterBadge) {
      if (activeSkills.length > 0) { skillCounterBadge.textContent = activeSkills.length; skillCounterBadge.classList.remove("hidden"); }
      else skillCounterBadge.classList.add("hidden");
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
    if (!toastContainer) return;
    const toast = document.createElement("div");
    toast.className = `toast-item toast-${type}`;
    toast.innerHTML = `<span class="toast-dot"></span><span>${message}</span>`;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(8px)";
      setTimeout(() => toast.remove(), 200);
    }, 2600);
  }

  async function handleFormSubmit(e) {
    e.preventDefault();
    const title = inputTitle ? inputTitle.value.trim() : "";
    const company = inputCompany ? inputCompany.value.trim() : "";
    if (!title || !company) { showToast("Job Title and Company are required", "error"); return; }
    if (!isServerOnline) { showToast("Not connected — click Sync Now in Settings", "error"); switchToTab("settings"); return; }
    if (btnSubmit) btnSubmit.disabled = true;
    if (btnSubmitText) btnSubmitText.textContent = "Saving...";
    const payload = {
      title, company,
      location: inputLocation ? inputLocation.value.trim() || null : null,
      salary_range: inputSalary ? inputSalary.value.trim() || null : null,
      work_location: selectWorkLocation ? selectWorkLocation.value || null : null,
      employment_type: selectEmploymentType ? selectEmploymentType.value || null : null,
      application_url: inputUrl ? inputUrl.value.trim() || null : null,
      description: textareaDescription ? textareaDescription.value.trim() || null : null,
      skills: activeSkills,
      source: "Chrome Extension",
      ...(activeContact || {}),
    };
    chrome.runtime.sendMessage({ type: "ADD_JOB_TO_ATTRACK", jobData: payload, serverUrl: currentServerUrl }, (response) => {
      if (btnSubmit) btnSubmit.disabled = false;
      if (btnSubmitText) btnSubmitText.textContent = "Save to Board";
      if (response && response.success) { showSuccess(false); showToast("Saved to BetterJob Wishlist", "success"); }
      else if (response && response.queued) { showSuccess(true); showToast("Saved locally — will sync once BetterJob is back online", "info"); refreshPendingBadge(); }
      else { showToast(`Couldn't save job: ${response?.error || "Unknown error"}`, "error"); }
    });
  }

  function showSuccess(queued) {
    if (jobForm) jobForm.classList.add("hidden");
    if (successBanner) successBanner.classList.remove("hidden");
    if (successTitle) successTitle.textContent = queued ? "Queued to sync" : "Saved to Wishlist";
    if (successSubtitle) successSubtitle.textContent = queued ? "Will be added the moment BetterJob is back online" : "Job added to BetterJob board";
    if (btnOpenBoard) {
      btnOpenBoard.classList.toggle("hidden", queued);
      if (!queued) {
        btnOpenBoard.addEventListener("click", () => chrome.tabs.create({ url: `${currentServerUrl}/board` }), { once: true });
      }
    }
  }
});
