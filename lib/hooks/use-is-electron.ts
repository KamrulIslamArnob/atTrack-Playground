"use client";

import { useEffect, useLayoutEffect, useState } from "react";

// window.electronAPI is set by the preload script before any page script runs,
// so it's already known by the time this ever gets to run — but reading it
// during the initial render would mismatch Next's server-rendered HTML (which
// has no `window`). useLayoutEffect settles it before paint, so components
// that mount post-hydration (sheets, dialogs) never flash the "not Electron"
// layout first; useEffect is the SSR-safe fallback (useLayoutEffect warns and
// no-ops on the server).
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function useIsElectron() {
  const [isElectron, setIsElectron] = useState(false);

  useIsomorphicLayoutEffect(() => {
    if (typeof window !== "undefined" && window.electronAPI?.isElectron) {
      setIsElectron(true);
    }
  }, []);

  return isElectron;
}
