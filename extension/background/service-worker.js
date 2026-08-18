// atTrack Chrome Extension Background Service Worker (Manifest V3)

const DEFAULT_SERVER_URL = "http://127.0.0.1:3308";

// Electron tries 3308 first and only falls back to a nearby port if
// something else already holds it (electron/main.js findPreferredPort) —
// probing the same short ladder is how the extension finds the app with zero
// manual setup, on install and on every relaunch after a port changes.
const CANDIDATE_PORTS = [3308, 3309, 3310, 3311, 3312];

// Ensure default settings on install — try to find the real app immediately
// instead of assuming the default port; falls back to it if nothing answers
// yet (e.g. the desktop app isn't running at install time).
chrome.runtime.onInstalled.addListener(async () => {
  const { serverUrl } = await chrome.storage.local.get("serverUrl");
  if (!serverUrl) {
    const found = await discoverServer();
    await chrome.storage.local.set({ serverUrl: found || DEFAULT_SERVER_URL });
  }
});

/** One candidate: does anything atTrack-shaped answer on this port? No auth
 *  needed here — /api/extension/status is intentionally open. */
async function probeUrl(url) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 800);
    const response = await fetch(`${url}/api/extension/status`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) return null;
    const data = await response.json();
    return data && data.appName === "atTrack" ? url : null;
  } catch {
    return null;
  }
}

/** Races the fixed port ladder and returns the first live atTrack instance. */
async function discoverServer() {
  const candidates = CANDIDATE_PORTS.map((port) => `http://127.0.0.1:${port}`);
  const results = await Promise.all(candidates.map(probeUrl));
  return results.find(Boolean) || null;
}

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
      } else if (message.type === "ADD_JOB_TO_ATTRACK") {
        const result = await addJobToAtTrack(message.jobData, message.serverUrl);
        sendResponse(result);
      } else if (message.type === "GET_SERVER_URL") {
        const { serverUrl = DEFAULT_SERVER_URL } = await chrome.storage.local.get("serverUrl");
        sendResponse({ serverUrl });
      } else if (message.type === "SET_SERVER_URL") {
        await chrome.storage.local.set({ serverUrl: message.serverUrl });
        sendResponse({ success: true });
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
    return { online: false, error: err.message || "Failed to reach local atTrack server", serverUrl: targetUrl };
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
    const timeoutId = setTimeout(() => controller.abort(), 12000);

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

async function addJobToAtTrack(jobData, customUrl) {
  const { serverUrl = DEFAULT_SERVER_URL } = await chrome.storage.local.get("serverUrl");
  const targetUrl = (customUrl || serverUrl).replace(/\/$/, "");

  try {
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
    if (response.ok && data.success) {
      return { success: true, jobId: data.jobId, message: data.message };
    }
    return { success: false, error: data.error || `HTTP ${response.status}` };
  } catch (err) {
    return { success: false, error: err.message || "Network request failed" };
  }
}
