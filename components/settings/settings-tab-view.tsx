"use client";

import { Suspense, useCallback, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { User, Palette, Sparkles, Monitor, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

// Settings cards
import { ProfileSettingsCard } from "@/components/settings/profile-settings-card";
import { ThemeSettings } from "@/components/settings/theme-settings";
import { AiProvidersSettings } from "@/components/settings/ai-providers-settings";
import { SmtpConfigFormWrapper } from "@/components/settings/smtp-config-form-wrapper";
import { ExtensionSettings } from "@/components/settings/extension-settings";
import { DataBackupCard } from "@/components/settings/data-backup-card";
import { OnboardingSettingsCard } from "@/components/settings/onboarding-settings-card";
import { RawDatabaseToggle } from "@/components/settings/raw-database-toggle";
import { DeleteAccount } from "@/components/settings/delete-account";
import { UpdateChecker } from "@/components/settings/update-checker";
import { StartupServiceCard } from "@/components/settings/startup-service-card";

import type { Profile } from "@/components/settings/profile-form";
import type { SmtpConfig } from "@/lib/actions/smtp";
import type { AiProviderSummary, TaskType } from "@/lib/types/ai-providers";

export type SettingsTabId = "information" | "appearance" | "ai" | "extension" | "desktop";

interface TabItem {
  id: SettingsTabId;
  label: string;
  badge?: string | number;
  icon: typeof User;
  description: string;
}

const SETTINGS_TABS: TabItem[] = [
  {
    id: "information",
    label: "Information",
    icon: User,
    description: "Personal profile, email configuration, backups, and local storage",
  },
  {
    id: "appearance",
    label: "Appearance",
    icon: Palette,
    description: "Theme selection and visual interface preferences",
  },
  {
    id: "ai",
    label: "AI settings",
    icon: Sparkles,
    description: "BYOK model providers, API keys, latency tests, and task routing",
  },
  {
    id: "extension",
    label: "Browser extension",
    icon: Globe,
    description: "Chrome companion web clipper connection, secret key, and scraper settings",
  },
  {
    id: "desktop",
    label: "Desktop app settings",
    icon: Monitor,
    description: "Desktop shell configuration, background services, and auto-updates",
  },
];

interface SettingsTabViewProps {
  profile: Profile;
  avatarUrl?: string | null;
  fullName?: string | null;
  showRawDatabase: boolean;
  smtpConfig: SmtpConfig | null;
  aiProviders: AiProviderSummary[];
  aiTaskRoutes: Record<TaskType, AiProviderSummary[]>;
  extensionSecret: string;
}

function SettingsTabContent({
  profile,
  avatarUrl,
  fullName,
  showRawDatabase,
  smtpConfig,
  aiProviders,
  aiTaskRoutes,
  extensionSecret,
}: SettingsTabViewProps) {
  const searchParams = useSearchParams();

  const tabParam = searchParams.get("tab") as SettingsTabId | null;
  const initialTab: SettingsTabId =
    tabParam && SETTINGS_TABS.some((t) => t.id === tabParam) ? tabParam : "information";

  const [activeTab, setActiveTab] = useState<SettingsTabId>(initialTab);

  useEffect(() => {
    if (tabParam && SETTINGS_TABS.some((t) => t.id === tabParam) && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [tabParam, activeTab]);

  const handleSelectTab = useCallback(
    (tabId: SettingsTabId) => {
      setActiveTab(tabId);
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.set("tab", tabId);
        window.history.replaceState(null, "", url.toString());
      }
    },
    []
  );

  return (
    <div className="space-y-6 w-full">
      {/* Segmented tab strip — single-surface borderless track with soft elevated active pill */}
      <div
        role="tablist"
        aria-label="Settings categories"
        className="inline-flex items-center gap-1 overflow-x-auto rounded-xl bg-muted/60 p-1 [scrollbar-width:none] w-full sm:w-fit"
      >
        {SETTINGS_TABS.map((tab) => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.id;
          const badgeCount = tab.id === "ai" ? aiProviders.length : undefined;

          return (
            <button
              key={tab.id}
              role="tab"
              type="button"
              aria-selected={isSelected}
              aria-controls={`settings-tabpanel-${tab.id}`}
              onClick={() => handleSelectTab(tab.id)}
              className={cn(
                "relative flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium tracking-tight transition-colors duration-150 cursor-pointer select-none",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-[0.98]",
                isSelected
                  ? "text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/40"
              )}
            >
              {isSelected && (
                <motion.div
                  layoutId="active-settings-tab"
                  className="absolute inset-0 rounded-lg bg-background shadow-xs"
                  transition={{ type: "spring", stiffness: 450, damping: 35 }}
                />
              )}

              <span className="relative z-10 flex items-center gap-2">
                <Icon
                  className={cn(
                    "size-3.5 transition-colors duration-150",
                    isSelected ? "text-primary" : "text-muted-foreground"
                  )}
                />
                <span>{tab.label}</span>
                {badgeCount !== undefined && badgeCount > 0 && (
                  <span
                    className={cn(
                      "flex size-4 items-center justify-center rounded-full text-[10px] font-bold transition-colors duration-150",
                      isSelected
                        ? "bg-primary/10 text-primary"
                        : "bg-muted-foreground/15 text-muted-foreground"
                    )}
                  >
                    {badgeCount}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels with zero-latency instant switching */}
      <div
        id={`settings-tabpanel-${activeTab}`}
        role="tabpanel"
        className="animate-in fade-in-50 duration-150"
      >
        {activeTab === "information" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Top Left: Profile Identity Hero */}
            <div className="lg:col-span-7">
              <ProfileSettingsCard
                profile={profile}
                avatarUrl={avatarUrl}
                fullName={fullName}
              />
            </div>

            {/* Top Right: Email SMTP Configuration */}
            <div className="lg:col-span-5">
              <SmtpConfigFormWrapper config={smtpConfig} />
            </div>

            {/* Bottom Left: Data Backups & Export */}
            <div className="lg:col-span-7">
              <section
                aria-labelledby="data-heading"
                className="rounded-2xl bg-muted p-4 sm:p-5"
              >
                <div className="mb-3">
                  <h3 id="data-heading" className="text-sm font-semibold tracking-tight text-foreground">
                    Data backups and export
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Export, copy, or restore your local database in JSON format
                  </p>
                </div>
                <div className="-mx-1 divide-y divide-border/50">
                  <DataBackupCard />
                </div>
              </section>
            </div>

            {/* Bottom Right: General Preferences & Danger Zone */}
            <div className="lg:col-span-5 space-y-5">
              {/* General Preferences */}
              <section
                aria-labelledby="general-heading"
                className="rounded-2xl bg-muted p-4 sm:p-5"
              >
                <div className="mb-3">
                  <h3 id="general-heading" className="text-sm font-semibold tracking-tight text-foreground">
                    General preferences
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Workspace setup, sample data cleanup, and database developer mode
                  </p>
                </div>
                <div className="-mx-1 divide-y divide-border/50">
                  <OnboardingSettingsCard />
                  <RawDatabaseToggle initialEnabled={showRawDatabase} />
                </div>
              </section>

              {/* Danger Zone */}
              <section
                aria-labelledby="danger-heading"
                className="rounded-2xl border border-destructive/25 bg-destructive/5 p-4 sm:p-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <h3 id="danger-heading" className="text-sm font-semibold text-destructive">
                      Delete all data
                    </h3>
                    <p className="mt-0.5 max-w-[48ch] text-xs leading-relaxed text-muted-foreground">
                      Permanently wipes every job, document, and local database record from this device.
                    </p>
                  </div>
                  <DeleteAccount confirmPhrase={fullName || "DELETE"} />
                </div>
              </section>
            </div>
          </div>
        )}

        {activeTab === "appearance" && (
          <div className="space-y-6">
            <ThemeSettings />
          </div>
        )}

        {activeTab === "ai" && (
          <div className="space-y-6">
            <AiProvidersSettings initialProviders={aiProviders} initialRoutes={aiTaskRoutes} />
          </div>
        )}

        {activeTab === "extension" && (
          <div className="space-y-6">
            <ExtensionSettings secret={extensionSecret} />
          </div>
        )}

        {activeTab === "desktop" && (
          <div className="space-y-6">
            <section
              aria-labelledby="desktop-heading"
              className="rounded-2xl bg-muted p-4 sm:p-5"
            >
              <div className="mb-3">
                <h3 id="desktop-heading" className="text-sm font-semibold tracking-tight text-foreground">
                  Desktop application
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  System startup, background services, tray minimization, and local server bridge
                </p>
              </div>
              <div className="-mx-1 divide-y divide-border/50">
                <UpdateChecker />
                <StartupServiceCard />
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

export function SettingsTabView(props: SettingsTabViewProps) {
  return (
    <Suspense
      fallback={
        <div className="space-y-6 animate-pulse">
          <div className="h-12 w-full rounded-2xl bg-muted/30" />
          <div className="h-64 w-full rounded-2xl bg-muted/20" />
        </div>
      }
    >
      <SettingsTabContent {...props} />
    </Suspense>
  );
}
