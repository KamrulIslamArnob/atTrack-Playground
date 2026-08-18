"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, ChevronDown } from "lucide-react";
import { AvatarUpload } from "@/components/settings/avatar-upload";
import { ProfileForm, type Profile } from "@/components/settings/profile-form";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";

interface ProfileSettingsCardProps {
  profile: Profile;
  avatarUrl?: string | null;
  fullName?: string | null;
}

export function ProfileSettingsCard({ profile, avatarUrl, fullName }: ProfileSettingsCardProps) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("attrack_profile_collapsed");
      if (stored === "true") {
        setCollapsed(true);
      }
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("attrack_profile_collapsed", String(next));
      return next;
    });
  };

  return (
    <Card className="border-border shadow-xs overflow-hidden transition-all py-0 gap-0">
      <CardHeader
        onClick={toggleCollapsed}
        className={cn(
          "cursor-pointer select-none px-6 py-5 hover:bg-muted/40 transition-colors",
          collapsed ? "rounded-2xl" : "rounded-t-2xl"
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <User className="size-4.5" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base font-semibold text-foreground">
                Personal Information & Profile
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm mt-0.5">
                Your profile photo, identity details, and contact info.
              </CardDescription>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={collapsed ? "Expand personal info" : "Minimize personal info"}
            className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              toggleCollapsed();
            }}
          >
            <ChevronDown
              className={cn(
                "size-4 transition-transform duration-200",
                collapsed ? "-rotate-90" : "rotate-0"
              )}
            />
          </Button>
        </div>
      </CardHeader>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <CardContent className="space-y-6 px-6 pb-6 pt-2">
              {/* Profile Avatar Section */}
              <AvatarUpload avatarUrl={avatarUrl} fullName={fullName} />

              {/* Divider */}
              <div className="border-t border-border/80" />

              {/* Profile Details Form */}
              <ProfileForm profile={profile} />
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
