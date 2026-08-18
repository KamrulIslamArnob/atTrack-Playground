"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

const STORAGE_KEY = "attrack:enable_json_sync";
const EVENT_NAME = "attrack:json_sync_changed";

function getSnapshot(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    return val === null ? true : val === "true";
  } catch {
    return true;
  }
}

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT_NAME, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT_NAME, callback);
    window.removeEventListener("storage", callback);
  };
}

export function setJsonSyncEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, String(enabled));
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: enabled }));
  } catch {
    // ignore
  }
}

export function useJsonSyncPreference() {
  const [mounted, setMounted] = useState(false);
  const enabled = useSyncExternalStore(subscribe, getSnapshot, () => true);

  useEffect(() => {
    setMounted(true);
  }, []);

  return {
    enabled: mounted ? enabled : true,
    setEnabled: setJsonSyncEnabled,
    mounted,
  };
}
