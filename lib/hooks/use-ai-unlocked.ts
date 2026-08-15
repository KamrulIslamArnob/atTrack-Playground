"use client";

import { useEffect, useState } from "react";
import { hasAnyProviderConfigured } from "@/lib/actions/ai-providers";

/** Gates any AI feature (chatbot, job AI tools) on the same check:
 *  hasAnyProviderConfigured — a provider that has actually tested successfully,
 *  or the zero-config GEMINI_API_KEY env fallback. `unlocked` starts `true` so
 *  nothing flashes locked before the check resolves; callers that need to
 *  distinguish "still checking" from "confirmed unlocked" can read `checked`. */
export function useAiUnlocked() {
  const [unlocked, setUnlocked] = useState(true);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let alive = true;
    hasAnyProviderConfigured()
      .then((ok) => {
        if (alive) setUnlocked(ok);
      })
      .catch(() => {
        // Fail open — a transient error checking shouldn't lock out a
        // working setup any more than the equivalent listProviders() failure
        // already does elsewhere on this page.
      })
      .finally(() => {
        if (alive) setChecked(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  return { unlocked, checked };
}
