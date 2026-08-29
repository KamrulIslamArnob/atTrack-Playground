"use client";

import { useState } from "react";
import { KeyRound, ShieldCheck, Eye, EyeOff, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { LicenseState } from "@/lib/actions/license";

interface LicenseInfoCardProps {
  licenseState: LicenseState;
}

export function LicenseInfoCard({ licenseState }: LicenseInfoCardProps) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const rawKey = licenseState.licenseKey || "BJOB-53TSJT-JAG8YZ-QY39Y8-05P15E";

  // Create masked representation: Keep BJOB prefix and last chunk visible, mask middle
  const parts = rawKey.split("-");
  const maskedKey =
    parts.length >= 3
      ? `${parts[0]}-${parts.slice(1, -1).map(() => "••••••").join("-")}-${parts[parts.length - 1]}`
      : "••••-••••••-••••••-••••••-••••";

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(rawKey);
      setCopied(true);
      toast.success("License key copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy license key to clipboard");
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs">
      {/* Header section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3.5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-foreground text-background shadow-xs">
            <KeyRound className="size-5" />
          </div>
          <div>
            <h2 className="flex items-center gap-1.5 text-base font-semibold tracking-tight text-foreground">
              Desktop Activation License <span className="text-amber-500">✨</span>
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Your personal license code unlocks all native desktop features and syncs cloud backups.
            </p>
          </div>
        </div>

        {/* Right Badges */}
        <div className="flex shrink-0 items-center gap-2 self-start">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="size-3.5 text-emerald-500" />
            Active
          </span>
          <span className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-semibold text-foreground">
            {licenseState.tier || "Pro Tier"}
          </span>
        </div>
      </div>

      {/* Activation Code Box Container */}
      <div className="mt-5 rounded-xl border border-border/80 bg-muted/20 p-4 sm:p-5">
        <div className="flex items-center justify-between pb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Activation Code
          </span>
          <button
            type="button"
            onClick={() => setRevealed((prev) => !prev)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground cursor-pointer select-none"
          >
            {revealed ? (
              <>
                <EyeOff className="size-3.5" />
                <span>Hide key</span>
              </>
            ) : (
              <>
                <Eye className="size-3.5" />
                <span>Reveal key</span>
              </>
            )}
          </button>
        </div>

        {/* Key String Field */}
        <div className="overflow-x-auto rounded-lg border border-border/80 bg-background px-4 py-3 font-mono text-sm sm:text-base font-bold tracking-widest text-foreground select-all">
          {revealed ? rawKey : maskedKey}
        </div>

        {/* Footer inside card */}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="h-8 gap-2 rounded-lg px-3 text-xs font-medium cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="size-3.5 text-emerald-500" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="size-3.5" />
                <span>Copy license key</span>
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground">
            Single-account, unlimited multi-device sync
          </p>
        </div>
      </div>
    </div>
  );
}
