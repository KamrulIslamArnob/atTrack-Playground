"use client";

import { useTransition } from "react";
import {
  Mail,
  Phone,
  MapPin,
  Globe,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  X,
} from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfile } from "@/lib/actions/auth";
import { toast } from "sonner";

export interface Profile {
  full_name?: string | null;
  email?: string | null;
  headline?: string | null;
  phone?: string | null;
  location?: string | null;
  website?: string | null;
}

interface ProfileFormProps {
  profile: Profile;
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;
}

function CopyableField({
  icon: Icon,
  label,
  value,
  isLink,
}: {
  icon: typeof Mail;
  label: string;
  value?: string | null;
  isLink?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} copied`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(`Couldn't copy ${label.toLowerCase()}`);
    }
  };

  return (
    <div className="group/item flex items-center justify-between gap-2 rounded-lg border border-border/40 bg-background/50 px-3 py-2 transition-colors hover:bg-background/80">
      <div className="flex items-center gap-2 min-w-0">
        <Icon className="size-3.5 shrink-0 text-muted-foreground/70" />
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70 leading-none">
            {label}
          </p>
          {value ? (
            isLink ? (
              <a
                href={value.startsWith("http") ? value : `https://${value}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 inline-flex items-center gap-1 truncate text-xs font-medium text-primary hover:underline"
              >
                <span className="truncate">{value.replace(/^https?:\/\//, "")}</span>
                <ExternalLink className="size-2.5 shrink-0 opacity-60" />
              </a>
            ) : (
              <p className="mt-0.5 truncate text-xs font-medium text-foreground">
                {value}
              </p>
            )
          ) : (
            <p className="mt-0.5 text-xs text-muted-foreground/50 italic leading-none">
              Not set
            </p>
          )}
        </div>
      </div>

      {value && !isLink && (
        <button
          type="button"
          onClick={handleCopy}
          className="opacity-0 group-hover/item:opacity-100 transition-opacity flex size-5 items-center justify-center rounded text-muted-foreground hover:text-foreground cursor-pointer"
          title={`Copy ${label.toLowerCase()}`}
        >
          {copied ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
        </button>
      )}
    </div>
  );
}

export function ProfileForm({ profile, isEditing, setIsEditing }: ProfileFormProps) {
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      try {
        await updateProfile(formData);
        setIsEditing(false);
        toast.success("Profile details saved");
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Couldn't save profile");
      }
    });
  };

  if (isEditing) {
    return (
      <form onSubmit={handleSubmit} className="space-y-3.5 animate-in fade-in-50 duration-150">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="full_name" className="text-xs font-medium text-foreground">
              Full name
            </Label>
            <Input
              id="full_name"
              name="full_name"
              defaultValue={profile?.full_name ?? ""}
              placeholder="Your full name"
              className="h-8.5 text-xs"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="email" className="text-xs font-medium text-foreground">
              Email address
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={profile?.email ?? ""}
              placeholder="your.email@domain.com"
              className="h-8.5 text-xs"
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="headline" className="text-xs font-medium text-foreground">
            Professional headline
          </Label>
          <Input
            id="headline"
            name="headline"
            defaultValue={profile?.headline ?? ""}
            placeholder="e.g. Software Engineer"
            className="h-8.5 text-xs"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="location" className="text-xs font-medium text-foreground">
              Location
            </Label>
            <Input
              id="location"
              name="location"
              defaultValue={profile?.location ?? ""}
              placeholder="e.g. Dhaka, Bangladesh"
              className="h-8.5 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="phone" className="text-xs font-medium text-foreground">
              Phone
            </Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={profile?.phone ?? ""}
              placeholder="e.g. +1 555 0123"
              className="h-8.5 text-xs"
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="website" className="text-xs font-medium text-foreground">
            Website / Portfolio
          </Label>
          <Input
            id="website"
            name="website"
            type="url"
            defaultValue={profile?.website ?? ""}
            placeholder="https://example.com"
            className="h-8.5 text-xs"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/40">
          <button
            type="button"
            disabled={isPending}
            onClick={() => setIsEditing(false)}
            className="micro-press inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted cursor-pointer disabled:opacity-50"
          >
            <X className="size-3" />
            <span>Cancel</span>
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="micro-press inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 cursor-pointer disabled:opacity-50"
          >
            {isPending ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
            <span>Save</span>
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <CopyableField icon={Mail} label="Email" value={profile?.email} />
      <CopyableField icon={Phone} label="Phone" value={profile?.phone} />
      <CopyableField icon={MapPin} label="Location" value={profile?.location} />
      <CopyableField icon={Globe} label="Website" value={profile?.website} isLink />
    </div>
  );
}
