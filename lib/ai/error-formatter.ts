/**
 * Formats raw AI provider error strings (e.g. Gemini 429 quota exceptions,
 * timeout aborts, OpenAI rate limits) into clean, human-readable UI messages.
 */
export function cleanAiErrorMessage(errorText: string): string {
  if (!errorText) return "AI request failed. Please try again.";

  let text = errorText;
  if (text.startsWith("All providers failed: ")) {
    text = text.slice("All providers failed: ".length);
  }

  const hops = text.split("; ").map((hop) => {
    let clean = hop.trim();
    // Remove nested "All providers failed: "
    clean = clean.replace(/All providers failed:\s*/gi, "");

    const colonIdx = clean.indexOf(":");
    const providerPrefix = colonIdx !== -1 ? clean.slice(0, colonIdx).trim() : "";

    // 1. Detect 429 / Quota / Rate Limit / RESOURCE_EXHAUSTED
    if (/429|quota|rate\s*limit|RESOURCE_EXHAUSTED/i.test(clean)) {
      return providerPrefix
        ? `${providerPrefix}: Quota / rate limit exceeded (429). Please wait a moment or use another provider.`
        : "Quota / rate limit exceeded (429). Please wait a moment or use another provider.";
    }

    // 2. Detect Timeout / Abort
    if (/timeout|aborted/i.test(clean)) {
      return providerPrefix
        ? `${providerPrefix}: Request timed out.`
        : "Request timed out.";
    }

    // 3. Detect 401 / 403 / Invalid Key
    if (/401|403|unauthorized|invalid.*key|api.*key.*invalid/i.test(clean)) {
      return providerPrefix
        ? `${providerPrefix}: Invalid API key or unauthorized.`
        : "Invalid API key or unauthorized. Please check Settings > AI Providers.";
    }

    // 4. Clean up other errors: strip URLs, JSON blocks, extra spaces
    clean = clean.replace(/https?:\/\/[^\s)]+/g, "");
    clean = clean.replace(/\{\s*"error"[\s\S]*?\}/g, "");
    clean = clean.replace(/\s+/g, " ").trim();
    if (clean.length > 180) {
      clean = clean.slice(0, 180) + "...";
    }
    return clean || "Unknown error occurred.";
  });

  return hops.length > 1 ? hops.join("\n• ") : hops[0];
}
