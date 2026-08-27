"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resetOnboarding, clearSampleDataAction } from "@/lib/actions/onboarding";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

/** Bare rows for the General section: onboarding replay + demo data cleanup. */
export function OnboardingSettingsCard() {
  const router = useRouter();
  const [resetting, setResetting] = useState(false);
  const [clearing, setClearing] = useState(false);

  const handleReplay = async () => {
    setResetting(true);
    try {
      await resetOnboarding();
      localStorage.removeItem("attrack-getting-started-dismissed");
      toast.success("Onboarding tour reset");
      router.refresh();
      router.push("/overview");
    } catch {
      toast.error("Couldn't reset onboarding");
    } finally {
      setResetting(false);
    }
  };

  const handleClearDemoData = async () => {
    setClearing(true);
    try {
      const res = await clearSampleDataAction();
      if (res.removedCount > 0) {
        toast.success(`Removed ${res.removedCount} sample jobs`);
      } else {
        toast.info("No sample data found.");
      }
      router.refresh();
    } catch {
      toast.error("Couldn't remove sample data");
    } finally {
      setClearing(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between gap-4 py-3 px-1">
        <div className="min-w-0">
          <p className="text-xs sm:text-sm font-medium text-foreground">Reset onboarding tour</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Restarts the interactive first-time setup guide and welcome wizard
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleReplay}
          disabled={resetting || clearing}
          className="h-8 px-2.5 text-xs shrink-0 gap-1.5"
        >
          {resetting ? <Loader2 className="size-3.5 animate-spin" /> : null}
          Reset tour
        </Button>
      </div>

      <div className="flex items-center justify-between gap-4 py-3 px-1">
        <div className="min-w-0">
          <p className="text-xs sm:text-sm font-medium text-foreground">Remove sample data</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Deletes demo jobs and sample contacts created during onboarding
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleClearDemoData}
          disabled={resetting || clearing}
          className="h-8 px-2.5 text-xs shrink-0 gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          {clearing ? <Loader2 className="size-3.5 animate-spin" /> : null}
          Remove data
        </Button>
      </div>
    </>
  );
}
