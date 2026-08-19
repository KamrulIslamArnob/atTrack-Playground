"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resetOnboarding, clearSampleDataAction } from "@/lib/actions/onboarding";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Compass, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function OnboardingSettingsCard() {
  const router = useRouter();
  const [resetting, setResetting] = useState(false);
  const [clearing, setClearing] = useState(false);

  const handleReplay = async () => {
    setResetting(true);
    try {
      await resetOnboarding();
      localStorage.removeItem("attrack-getting-started-dismissed");
      toast.success("Onboarding tour reset. Reloading workspace...");
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
        toast.success(`Removed ${res.removedCount} sample jobs and associated demo data.`);
      } else {
        toast.info("No sample/demo data found.");
      }
      router.refresh();
    } catch {
      toast.error("Couldn't remove sample data");
    } finally {
      setClearing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Compass className="size-4" />
          Onboarding & Demo Data
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">Replay onboarding setup</p>
            <p className="text-xs text-muted-foreground">
              Rerun the first-time setup wizard to configure your profile, resume, AI keys, or load demo jobs.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReplay}
            disabled={resetting || clearing}
            className="shrink-0 gap-1.5"
          >
            {resetting ? <Loader2 className="size-3.5 animate-spin" /> : <Compass className="size-3.5" />}
            <span>Replay setup</span>
          </Button>
        </div>

        <div className="border-t pt-4 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">Clean up sample data</p>
            <p className="text-xs text-muted-foreground">
              Remove all demo jobs, contacts, and interview cards created during onboarding.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearDemoData}
            disabled={resetting || clearing}
            className="shrink-0 gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            {clearing ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
            <span>Clear demo data</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
