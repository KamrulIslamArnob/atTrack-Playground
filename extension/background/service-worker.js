// atTrack Chrome Extension Background Service Worker (Manifest V3)

const DEFAULT_SERVER_URL = "http://127.0.0.1:3788";

// Electron tries 3788 first and only falls back to a nearby port if
// something else already holds it (electron/main.js findPreferredPort) —
// probing the same short ladder is how the extension finds the app with zero
// manual setup, on install and on every relaunch after a port changes.
const CANDIDATE_PORTS = [3788, 3789, 3790, 3791, 3792, 3000, 3001, 3002, 3100, 5173, 8080];

// Ensure default settings on install and configure side panel behavior
chrome.runtime.onInstalled.addListener(async () => {
  const { serverUrl } = await chrome.storage.local.get("serverUrl");
  if (!serverUrl) {
    const found = await discoverServer();
    await chrome.storage.local.set({ serverUrl: found || DEFAULT_SERVER_URL });
  }

  // Enable side panel to open upon clicking the extension action icon
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err) => {
      console.warn("Side panel behavior setup:", err);
    });
  }
});

// Configure side panel behavior on startup
if (chrome.sidePanel?.setPanelBehavior) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
}

// Fallback action click handler for opening side panel
chrome.action?.onClicked?.addListener(async (tab) => {
  if (chrome.sidePanel?.open && tab?.windowId) {
    try {
      await chrome.sidePanel.open({ windowId: tab.windowId });
    } catch (e) {
      console.warn("Could not open side panel:", e);
    }
  }
});

/** One candidate: does anything atTrack-shaped answer on this port? No auth
 *  needed here — /api/extension/status is intentionally open. */
async function probeUrl(url) {
  if (!url) return null;
  const cleanUrl = url.replace(/\/$/, "");
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const response = await fetch(`${cleanUrl}/api/extension/status`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) return null;
    const data = await response.json();
    return data && (data.appName === "BetterJob" || data.appName === "Better-Job" || data.appName === "atTrack") ? cleanUrl : null;
  } catch {
    return null;
  }
}

/** Races open tabs and candidate port ladder, returning the first live atTrack instance. */
async function discoverServer() {
  // Step 1: Check active/open browser tabs for atTrack origins
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (
        tab.url &&
        (tab.url.startsWith("http://localhost:") ||
          tab.url.startsWith("http://127.0.0.1:") ||
          tab.url.startsWith("http://localhost/") ||
          tab.url.startsWith("http://127.0.0.1/"))
      ) {
        try {
          const origin = new URL(tab.url).origin;
          const liveUrl = await probeUrl(origin);
          if (liveUrl) {
            await chrome.storage.local.set({ serverUrl: liveUrl });
            flushPendingJobs();
            return liveUrl;
          }
        } catch {
          // ignore invalid tab URL
        }
      }
    }
  } catch {
    // tab query unavailable
  }

  // Step 2: Probe common local ports
  const candidates = [];
  for (const port of CANDIDATE_PORTS) {
    candidates.push(`http://127.0.0.1:${port}`);
    candidates.push(`http://localhost:${port}`);
  }
  const results = await Promise.all(candidates.map(probeUrl));
  const found = results.find(Boolean) || null;
  if (found) {
    await chrome.storage.local.set({ serverUrl: found });
    flushPendingJobs();
  }
  return found;
}

// --- Offline queue: a save that couldn't reach the server waits here instead
// of being lost, and is retried automatically once the server is reachable
// again (chrome.alarms below, plus opportunistically on every successful
// discoverServer/status check). ---

const PENDING_JOBS_KEY = "pendingJobs";
const FLUSH_ALARM = "flush-pending-jobs";

async function getPendingJobs() {
  const { [PENDING_JOBS_KEY]: jobs } = await chrome.storage.local.get(PENDING_JOBS_KEY);
  return Array.isArray(jobs) ? jobs : [];
}

async function queuePendingJob(jobData) {
  const jobs = await getPendingJobs();
  jobs.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, jobData, queuedAt: Date.now() });
  await chrome.storage.local.set({ [PENDING_JOBS_KEY]: jobs });
}

/** One POST attempt, shared by the direct save path and the queue flush. */
async function postJob(targetUrl, jobData) {
  const response = await fetch(`${targetUrl}/api/extension/add-job`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...(await authHeaders()),
    },
    body: JSON.stringify(jobData),
  });
  const data = await response.json();
  return response.ok && data.success
    ? { success: true, jobId: data.jobId, message: data.message }
    : { success: false, error: data.error || `HTTP ${response.status}` };
}

/** Retries every queued save. A network-level failure (server still
 *  unreachable) keeps an item queued; a real server response — even a
 *  rejection — removes it, since retrying the same bad request forever won't
 *  fix a stale secret or a validation error the user needs to see instead. */
async function flushPendingJobs() {
  const jobs = await getPendingJobs();
  if (jobs.length === 0) return 0;

  const { serverUrl = DEFAULT_SERVER_URL } = await chrome.storage.local.get("serverUrl");
  const targetUrl = serverUrl.replace(/\/$/, "");

  const remaining = [];
  let flushed = 0;

  for (const item of jobs) {
    try {
      const result = await postJob(targetUrl, item.jobData);
      if (result.success) {
        flushed++;
      }
      // else: the server answered with a real rejection — drop it rather
      // than retry a request that will keep failing the same way.
    } catch {
      remaining.push(item); // still unreachable — keep it queued
    }
  }

  await chrome.storage.local.set({ [PENDING_JOBS_KEY]: remaining });
  return flushed;
}

chrome.alarms.create(FLUSH_ALARM, { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === FLUSH_ALARM) discoverServer();
});
chrome.runtime.onStartup.addListener(() => discoverServer());

// Message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message.type === "CHECK_SERVER_STATUS") {
        const result = await checkServerStatus(message.serverUrl);
        sendResponse(result);
      } else if (message.type === "DISCOVER_SERVER") {
        const found = await discoverServer();
        if (found) await chrome.storage.local.set({ serverUrl: found });
        sendResponse({ found: Boolean(found), serverUrl: found || null });
      } else if (message.type === "PARSE_JOB_AI") {
        const result = await parseJobAI(message.payload, message.serverUrl);
        sendResponse(result);
      } else if (message.type === "PARSE_MANUAL_AI") {
        const result = await parseManualAI(message.payload, message.serverUrl);
        sendResponse(result);
      } else if (message.type === "ADD_JOB_TO_ATTRACK") {
        const result = await addJobToAtTrack(message.jobData, message.serverUrl);
        sendResponse(result);
      } else if (message.type === "GET_PENDING_COUNT") {
        const jobs = await getPendingJobs();
        sendResponse({ count: jobs.length });
      } else if (message.type === "FLUSH_PENDING_JOBS") {
        const flushed = await flushPendingJobs();
        const remaining = await getPendingJobs();
        sendResponse({ flushed, remaining: remaining.length });
      } else if (message.type === "GET_SERVER_URL") {
        const { serverUrl = DEFAULT_SERVER_URL } = await chrome.storage.local.get("serverUrl");
        sendResponse({ serverUrl });
      } else if (message.type === "SET_SERVER_URL") {
        await chrome.storage.local.set({ serverUrl: message.serverUrl });
        sendResponse({ success: true });
      } else if (message.type === "SYNC_CONFIG") {
        const updates = {};
        if (message.serverUrl) updates.serverUrl = message.serverUrl.replace(/\/$/, "");
        if (message.secret) updates.authSecret = message.secret;
        if (message.firecrawlApiKey !== undefined) updates.firecrawlApiKey = message.firecrawlApiKey;
        await chrome.storage.local.set(updates);
        if (updates.serverUrl) flushPendingJobs();
        const manifest = chrome.runtime.getManifest();
        sendResponse({ success: true, version: manifest?.version || "1.0.0", serverUrl: updates.serverUrl });
      } else if (message.type === "OPEN_EXTENSION_POPUP" || message.type === "OPEN_SIDE_PANEL") {
        try {
          if (chrome.sidePanel && typeof chrome.sidePanel.open === "function") {
            if (sender.tab?.id) {
              await chrome.sidePanel.open({ tabId: sender.tab.id });
            } else if (sender.tab?.windowId) {
              await chrome.sidePanel.open({ windowId: sender.tab.windowId });
            } else {
              const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
              if (activeTab?.id) {
                await chrome.sidePanel.open({ tabId: activeTab.id });
              }
            }
            sendResponse({ success: true });
          } else if (chrome.action && typeof chrome.action.openPopup === "function") {
            await chrome.action.openPopup();
            sendResponse({ success: true });
          } else {
            sendResponse({ success: false, error: "Side panel not supported in this browser" });
          }
        } catch (e) {
          // Fallback to openPopup if sidePanel fails
          if (chrome.action && typeof chrome.action.openPopup === "function") {
            try {
              await chrome.action.openPopup();
              sendResponse({ success: true });
              return;
            } catch {}
          }
          sendResponse({ success: false, error: e.message || String(e) });
        }
      } else {
        sendResponse({ error: "Unknown message type" });
      }
    } catch (err) {
      sendResponse({ success: false, error: err.message || String(err) });
    }
  })();

  return true; // Keep channel open for async response
});

async function checkServerStatus(customUrl) {
  const { serverUrl = DEFAULT_SERVER_URL } = await chrome.storage.local.get("serverUrl");
  const targetUrl = (customUrl || serverUrl).replace(/\/$/, "");

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(`${targetUrl}/api/extension/status`, {
      method: "GET",
      headers: { "Accept": "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      return { online: true, data, serverUrl: targetUrl };
    }
    return { online: false, error: `HTTP ${response.status}`, serverUrl: targetUrl };
  } catch (err) {
    return { online: false, error: err.message || "Failed to reach local BetterJob server", serverUrl: targetUrl };
  }
}

/** Extension API calls require the shared secret from atTrack Settings > Browser extension. */
async function authHeaders() {
  const { authSecret } = await chrome.storage.local.get("authSecret");
  return authSecret ? { Authorization: `Bearer ${authSecret}` } : {};
}

async function parseJobAI(payload, customUrl) {
  const { serverUrl = DEFAULT_SERVER_URL } = await chrome.storage.local.get("serverUrl");
  const targetUrl = (customUrl || serverUrl).replace(/\/$/, "");

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const response = await fetch(`${targetUrl}/api/extension/parse-job-ai`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        ...(await authHeaders()),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const data = await response.json();
    return data;
  } catch (err) {
    return { success: false, error: err.message || "AI parse request failed" };
  }
}

async function parseManualAI(payload, customUrl) {
  const { serverUrl = DEFAULT_SERVER_URL } = await chrome.storage.local.get("serverUrl");
  const targetUrl = (customUrl || serverUrl).replace(/\/$/, "");
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    const response = await fetch(`${targetUrl}/api/extension/parse-manual-ai`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        ...(await authHeaders()),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (response.status === 404) {
      // Fallback: endpoint not yet deployed — use legacy parse-job-ai with text/url
      const fallbackPayload = {
        url: payload.url || "",
        pageText: payload.text || "",
        layer1Data: { title: "", company: "" },
        firecrawlApiKey: payload.firecrawlApiKey,
      };
      return await parseJobAI(fallbackPayload, customUrl);
    }
    const data = await response.json();
    return data;
  } catch (err) {
    return { success: false, error: err.message || "Manual AI parse failed" };
  }
}

async function addJobToAtTrack(jobData, customUrl) {
  const { serverUrl = DEFAULT_SERVER_URL } = await chrome.storage.local.get("serverUrl");
  const targetUrl = (customUrl || serverUrl).replace(/\/$/, "");

  try {
    return await postJob(targetUrl, jobData);
  } catch {
    // fetch() itself threw — server unreachable, not a rejection from it.
    // Queue instead of losing the job; the alarm/discovery flow above
    // retries automatically once the server answers again.
    await queuePendingJob(jobData);
    return {
      success: false,
      queued: true,
      error: "BetterJob is unreachable right now. Saved locally — it'll sync automatically once the app is back online.",
    };
  }
}
