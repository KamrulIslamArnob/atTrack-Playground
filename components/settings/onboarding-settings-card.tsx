"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resetOnboarding } from "@/lib/actions/onboarding";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Compass, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function OnboardingSettingsCard() {
  const router = useRouter();
  const [resetting, setResetting] = useState(false);

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Compass className="size-4" />
          Onboarding & Getting Started
        </CardTitle>
      </CardHeader>
      <CardContent>
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
            disabled={resetting}
            className="shrink-0 gap-1.5"
          >
            {resetting ? <Loader2 className="size-3.5 animate-spin" /> : <Compass className="size-3.5" />}
            <span>Replay setup</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
