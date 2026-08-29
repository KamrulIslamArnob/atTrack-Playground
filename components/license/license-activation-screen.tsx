"use client";

import { useState, useTransition, useEffect } from "react";
import { toast } from "sonner";
import { ShieldCheck, Sparkles, KeyRound, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  activateLicense,
  activateLicenseWithToken,
  getDeviceIdentifier,
} from "@/lib/actions/license";

export function LicenseActivationScreen() {
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isConnectingAuto, setIsConnectingAuto] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);

  // Listen for custom protocol deep link callbacks from browser
  useEffect(() => {
    const cleanup = window.electronAPI?.onDeepLinkActivate?.(async (payload) => {
      if (payload?.key && payload?.token) {
        toast.loading("Connecting workstation...", { id: "deep-act" });
        const result = await activateLicenseWithToken(payload.token, payload.key);
        if (result.success) {
          toast.success("Workstation connected successfully!", { id: "deep-act" });
          window.location.reload();
        } else {
          setError(result.error || "Could not activate workstation.");
          toast.error(result.error || "Activation failed.", { id: "deep-act" });
        }
      }
    });

    // Check for cold-start deep link
    window.electronAPI?.getPendingDeepLink?.().then(async (payload) => {
      if (payload?.key && payload?.token) {
        toast.loading("Connecting workstation...", { id: "deep-act" });
        const result = await activateLicenseWithToken(payload.token, payload.key);
        if (result.success) {
          toast.success("Workstation connected successfully!", { id: "deep-act" });
          window.location.reload();
        }
      }
    }).catch(() => {});

    return () => cleanup?.();
  }, []);

  async function handleAutoConnect() {
    setError(null);
    setIsConnectingAuto(true);

    try {
      const base = process.env.NEXT_PUBLIC_ATTRACK_WEBSITE_URL;
      if (!base) {
        setError("Activation server URL is not configured.");
        setIsConnectingAuto(false);
        return;
      }

      const deviceId = await getDeviceIdentifier();
      const queryParams = new URLSearchParams({
        device_id: deviceId,
        platform: typeof window !== "undefined" && navigator.userAgent.includes("Mac") ? "darwin" : "win32",
      });

      const connectUrl = `${base}/connect?${queryParams.toString()}`;

      if (window.electronAPI?.openExternalUrl) {
        await window.electronAPI.openExternalUrl(connectUrl);
      } else {
        window.open(connectUrl, "_blank", "noopener,noreferrer");
      }

      toast.info("Opening BetterJob in your browser. Sign in to connect instantly.", {
        duration: 8000,
      });
    } catch {
      setError("Failed to open connection page.");
    } finally {
      setTimeout(() => setIsConnectingAuto(false), 4000);
    }
  }

  function handleManualActivate() {
    setError(null);
    startTransition(async () => {
      const result = await activateLicense(key);
      if (result.success) {
        toast.success("Device activated — you're all set!");
        window.location.reload();
      } else {
        setError(result.error ?? "Couldn't activate that key.");
      }
    });
  }

  return (
    <div className="flex flex-1 items-center justify-center overflow-y-auto p-4">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-lg">
        <div className="flex flex-col items-center text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-brand shadow-sm">
            <ShieldCheck className="size-7 text-primary-foreground" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground">
            Activate BetterJob
          </h1>
          <p className="mt-1.5 max-w-[38ch] text-sm text-muted-foreground leading-relaxed">
            Free forever — connect your account to unlock Pro features and encrypted cloud sync.
          </p>
        </div>

        {/* Primary Action: 1-Click Browser SSO Connection */}
        <div className="mt-6 flex flex-col gap-2.5">
          <Button
            type="button"
            size="lg"
            className="w-full gap-2 bg-gradient-brand text-primary-foreground hover:opacity-90 font-semibold shadow-sm h-11"
            onClick={handleAutoConnect}
            disabled={isConnectingAuto}
          >
            {isConnectingAuto ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Opening browser…
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                Sign In &amp; Connect Automatically
              </>
            )}
          </Button>
          <p className="text-center text-xs text-muted-foreground px-2">
            Opens BetterJob in your browser. If you&apos;re already logged in, it connects instantly.
          </p>
        </div>

        {/* Manual Key Section Toggle */}
        <div className="mt-6 border-t border-border pt-4 text-center">
          {!showManualInput ? (
            <button
              type="button"
              onClick={() => setShowManualInput(true)}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors cursor-pointer py-1"
            >
              <KeyRound className="size-3.5" />
              Have a license key? Enter it manually
            </button>
          ) : (
            <div className="flex flex-col gap-3 text-left animate-in fade-in-50 duration-200">
              <div className="flex items-center justify-between">
                <Label htmlFor="license-key" className="text-xs font-semibold">
                  Manual License Key
                </Label>
                <button
                  type="button"
                  onClick={() => setShowManualInput(false)}
                  className="text-[11px] text-muted-foreground hover:text-foreground"
                >
                  Hide
                </button>
              </div>

              <Input
                id="license-key"
                placeholder="BJOB-XXXXXX-XXXXXX-XXXXXX-XXXXXX"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                aria-invalid={error ? true : undefined}
                className="font-mono text-xs uppercase tracking-wide h-10"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && key.trim() && !isPending) handleManualActivate();
                }}
              />

              {error && <p className="text-xs text-destructive">{error}</p>}

              <Button
                type="button"
                variant="outline"
                className="w-full font-medium"
                onClick={handleManualActivate}
                disabled={isPending || !key.trim()}
              >
                {isPending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin mr-1.5" />
                    Activating…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-3.5 mr-1.5 text-emerald-500" />
                    Activate Key
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
