"use client";

import { useEffect, useState } from "react";

export function useIsElectron() {
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.electronAPI?.isElectron) {
      setIsElectron(true);
    }
  }, []);

  return isElectron;
}
