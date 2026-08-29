"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resetOnboarding, clearSampleDataAction, seedDemoDataAction } from "@/lib/actions/onboarding";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, Trash2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

/** Bare rows for the General section: onboarding replay + demo data seed & cleanup. */
export function OnboardingSettingsCard() {
  const router = useRouter();
  const [resetting, setResetting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [seeding, setSeeding] = useState(false);

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

  const handleSeedDemoData = async () => {
    setSeeding(true);
    try {
      const res = await seedDemoDataAction();
      if (res.success) {
        toast.success(`Seeded ${res.jobCount} jobs, ${res.companyCount} companies, and ${res.contactCount} network contacts`);
        router.refresh();
      } else {
        toast.error("Couldn't seed demo data");
      }
    } catch {
      toast.error("Couldn't seed demo data");
    } finally {
      setSeeding(false);
    }
  };

  const handleClearDemoData = async () => {
    setClearing(true);
    try {
      const res = await clearSampleDataAction();
      if (res.removedCount > 0) {
        toast.success(`Removed ${res.removedCount} sample jobs and all demo data`);
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
          <p className="text-xs sm:text-sm font-medium text-foreground">Populate showcase demo data</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Seeds 17+ Big Tech companies, 20+ famous network contacts, all pipeline board stages, interviews, and resources
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSeedDemoData}
          disabled={resetting || clearing || seeding}
          className="h-8 px-2.5 text-xs shrink-0 gap-1.5 border-primary/40 bg-primary/5 hover:bg-primary hover:text-white hover:border-primary transition-all text-primary font-medium"
        >
          {seeding ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
          Seed demo data
        </Button>
      </div>

      <div className="flex items-center justify-between gap-4 py-3 px-1">
        <div className="min-w-0">
          <p className="text-xs sm:text-sm font-medium text-foreground">Delete all demo data</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Wipes all sample jobs, demo companies, contacts, interviews, applications, and links in one click
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleClearDemoData}
          disabled={resetting || clearing || seeding}
          className="h-8 px-2.5 text-xs shrink-0 gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
        >
          {clearing ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
          Delete demo data
        </Button>
      </div>

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
          disabled={resetting || clearing || seeding}
          className="h-8 px-2.5 text-xs shrink-0 gap-1.5"
        >
          {resetting ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
          Reset tour
        </Button>
      </div>
    </>
  );
}
