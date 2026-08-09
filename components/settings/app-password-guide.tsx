"use client";

import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

interface AppPasswordGuideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AppPasswordGuide({ open, onOpenChange }: AppPasswordGuideProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold">Gmail App Password Setup</h2>
          <button
            onClick={() => onOpenChange(false)}
            className="flex size-8 items-center justify-center rounded-2xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            ✕
          </button>
        </div>

        <div className="mt-5 space-y-5 text-sm">
          {/* Step 1 */}
          <div className="flex gap-3">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              1
            </div>
            <div>
              <p className="font-medium">Enable 2-Step Verification</p>
              <p className="mt-1 text-muted-foreground">
                App Passwords require 2-Step Verification on your Google account. If you haven&apos;t
                enabled it yet, do that first.
              </p>
              <a
                href="https://myaccount.google.com/security"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Google Security Settings
                <ExternalLink className="size-3" />
              </a>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-3">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              2
            </div>
            <div>
              <p className="font-medium">Open App Passwords page</p>
              <p className="mt-1 text-muted-foreground">
                Go to your Google Account&apos;s App Passwords section directly.
              </p>
              <a
                href="https://myaccount.google.com/apppasswords"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Open App Passwords
                <ExternalLink className="size-3" />
              </a>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-3">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              3
            </div>
            <div>
              <p className="font-medium">Generate a new App Password</p>
              <p className="mt-1 text-muted-foreground">
                Select <strong>Mail</strong> as the app and <strong>Other (Custom name)</strong> as the
                device. Name it something like &quot;AtTrack&quot; and click{" "}
                <strong>Generate</strong>.
              </p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex gap-3">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              4
            </div>
            <div>
              <p className="font-medium">Copy the 16-character password</p>
              <p className="mt-1 text-muted-foreground">
                Google will show a 16-character password (like{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                  abcd efgh ijkl mnop
                </code>
                ). Copy it and paste it into the App Password field in Settings. You won&apos;t be
                able to see it again.
              </p>
            </div>
          </div>

          {/* Security note */}
          <div className="rounded-2xl bg-muted/50 p-4">
            <p className="text-xs text-muted-foreground">
              <strong>Security:</strong> Your App Password is encrypted with AES-256-GCM before
              storage. It&apos;s only decrypted server-side when sending emails. We never send it to
              any third party.
            </p>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <Button size="sm" onClick={() => onOpenChange(false)}>
            Got it
          </Button>
        </div>
      </div>
    </div>
  );
}
