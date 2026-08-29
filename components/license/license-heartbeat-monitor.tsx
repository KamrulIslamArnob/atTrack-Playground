"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { verifyLicenseSilent, activateLicenseWithToken } from "@/lib/actions/license";

const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function LicenseHeartbeatMonitor() {
  const isVerifyingRef = useRef(false);

  useEffect(() => {
    // 1. Listen for deep-link activation payloads from Electron
    const cleanupDeepLink = window.electronAPI?.onDeepLinkActivate?.(
      async (payload: { key?: string; token?: string; email?: string }) => {
        if (payload?.key && payload?.token) {
          toast.loading("Activating workstation...", { id: "deep-link-act" });
          const res = await activateLicenseWithToken(payload.token, payload.key);
          if (res.success) {
            toast.success(
              payload.email ? `Connected as ${payload.email}!` : "Workstation activated!",
              { id: "deep-link-act" }
            );
            window.location.reload();
          } else {
            toast.error(res.error || "Failed to activate via deep link.", { id: "deep-link-act" });
          }
        }
      }
    );

    // Also check if there was a pending deep link received before window mounted
    window.electronAPI?.getPendingDeepLink?.().then(async (payload: { key?: string; token?: string; email?: string } | null) => {
      if (payload?.key && payload?.token) {
        toast.loading("Activating workstation...", { id: "deep-link-act" });
        const res = await activateLicenseWithToken(payload.token, payload.key);
        if (res.success) {
          toast.success(
            payload.email ? `Connected as ${payload.email}!` : "Workstation activated!",
            { id: "deep-link-act" }
          );
          window.location.reload();
        }
      }
    }).catch(() => {});

    // 2. Periodic 5-minute silent heartbeat
    async function runHeartbeat() {
      if (isVerifyingRef.current) return;
      isVerifyingRef.current = true;
      try {
        const result = await verifyLicenseSilent();
        if (!result.valid) {
          toast.error("Your license was revoked or this workstation was unlinked.");
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        }
      } catch {
        // Transient network error, will retry on next cycle
      } finally {
        isVerifyingRef.current = false;
      }
    }

    const intervalId = setInterval(runHeartbeat, HEARTBEAT_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
      cleanupDeepLink?.();
    };
  }, []);

  return null;
}
