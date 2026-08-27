"use client";

import { useState } from "react";
import { AvatarUpload } from "@/components/settings/avatar-upload";
import { ProfileForm, type Profile } from "@/components/settings/profile-form";
import { Pencil } from "lucide-react";

interface ProfileSettingsCardProps {
  profile: Profile;
  avatarUrl?: string | null;
  fullName?: string | null;
}

export function ProfileSettingsCard({ profile, avatarUrl, fullName }: ProfileSettingsCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const displayName = profile?.full_name || fullName || "Career Workspace Owner";
  const headline = profile?.headline || "Software Professional";

  return (
    <section
      aria-labelledby="profile-heading"
      className="rounded-2xl bg-muted p-4 sm:p-5"
    >
      {/* Compact Header: Avatar + Identity + Edit Trigger */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3.5 min-w-0">
          <AvatarUpload avatarUrl={avatarUrl} fullName={displayName} />

          <div className="min-w-0 space-y-0.5">
            <h2
              id="profile-heading"
              className="truncate text-sm sm:text-base font-bold tracking-tight text-foreground"
            >
              {displayName}
            </h2>
            <p className="truncate text-xs text-muted-foreground font-medium">
              {headline}
            </p>
          </div>
        </div>

        {!isEditing && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="micro-press shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted cursor-pointer"
          >
            <Pencil className="size-3" />
            <span>Edit</span>
          </button>
        )}
      </div>

      {/* Compact Metadata Details / Edit Form */}
      <div className="mt-4 pt-3.5 border-t border-border/50">
        <ProfileForm
          profile={profile}
          isEditing={isEditing}
          setIsEditing={setIsEditing}
        />
      </div>
    </section>
  );
}
