// atTrack Web App Bridge - Content Script
// Automatically syncs server URL and extension secret between atTrack web app and Chrome extension

(function () {
  window.addEventListener("message", (event) => {
    if (event.source !== window || !event.data || typeof event.data !== "object") return;
    if (event.data.type === "ATTRACK_PAIR_EXTENSION") {
      const { serverUrl, secret, firecrawlApiKey } = event.data;
      if (!serverUrl) return;
      try {
        chrome.runtime.sendMessage(
          { type: "SYNC_CONFIG", serverUrl, secret, firecrawlApiKey },
          (response) => {
            if (chrome.runtime.lastError) return;
            if (response && response.success) {
              window.postMessage(
                { type: "ATTRACK_PAIR_EXTENSION_ACK", success: true, version: response.version || "1.0.0", serverUrl: response.serverUrl || serverUrl },
                "*"
              );
            }
          }
        );
      } catch {}
    }
  });

  function announceExtension() {
    try {
      const manifest = chrome.runtime.getManifest();
      window.postMessage({ type: "ATTRACK_EXTENSION_PRESENT", version: manifest?.version || "1.0.0" }, "*");
    } catch {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", announceExtension);
  } else {
    announceExtension();
  }
})();
