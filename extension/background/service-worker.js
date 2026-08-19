// atTrack Chrome Extension Background Service Worker (Manifest V3)

const DEFAULT_SERVER_URL = "http://127.0.0.1:3788";

// Electron tries 3788 first and only falls back to a nearby port if
// something else already holds it (electron/main.js findPreferredPort) —
// probing the same short ladder is how the extension finds the app with zero
// manual setup, on install and on every relaunch after a port changes.
const CANDIDATE_PORTS = [3788, 3789, 3790, 3791, 3792];

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
  const found = results.find(Boolean) || null;
  if (found) flushPendingJobs(); // just learned the server is reachable — try to drain the offline queue
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
    return await postJob(targetUrl, jobData);
  } catch (err) {
    // fetch() itself threw — server unreachable, not a rejection from it.
    // Queue instead of losing the job; the alarm/discovery flow above
    // retries automatically once the server answers again.
    await queuePendingJob(jobData);
    return {
      success: false,
      queued: true,
      error: "atTrack is unreachable right now. Saved locally — it'll sync automatically once the app is back online.",
    };
  }
}
