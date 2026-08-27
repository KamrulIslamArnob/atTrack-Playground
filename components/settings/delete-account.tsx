"use client";

import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { resetAllData } from "@/lib/actions/auth";

interface ResetAllDataProps {
  /** Typed by the user to confirm. The profile name, since there is no account email. */
  confirmPhrase: string;
}

const dataItems = [
  "All jobs, applications, and companies",
  "Board lists and positions",
  "Interviews and MCQ results",
  "Documents and resumes",
  "SMTP configuration",
  "Activity and AI usage history",
  "All uploaded files",
];

export function DeleteAccount({ confirmPhrase }: ResetAllDataProps) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const isMatch = confirmation.trim() === confirmPhrase.trim() && confirmPhrase.trim() !== "";

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isMatch) return;
    setIsDeleting(true);
    const formData = new FormData();
    formData.append("confirmation", confirmation);
    await resetAllData(formData);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="micro-press inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-destructive/20 bg-destructive/5 px-3.5 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/30"
      >
        <AlertTriangle className="size-3.5" aria-hidden="true" />
        Delete all data
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex w-full max-w-[420px] max-h-[85vh] flex-col overflow-hidden rounded-3xl bg-card shadow-e4">
            <div className="px-6 pt-6">
              <h2 className="font-heading text-base font-semibold leading-none">Delete all data?</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                This wipes the workspace on this device. It can’t be undone.
              </p>
            </div>

            <div className="mt-4 border-y border-border bg-muted/20 px-6 py-3">
              <p className="text-xs font-medium text-muted-foreground">This will erase</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {dataItems.join(" · ")}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-6 py-5">
              <label htmlFor="confirm-phrase" className="space-y-2">
                <span className="text-sm font-medium">
                  Type <span className="font-mono text-sm font-semibold text-foreground">{confirmPhrase}</span> to confirm
                </span>
                <input
                  id="confirm-phrase"
                  type="text"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  placeholder={confirmPhrase}
                  autoComplete="off"
                  autoFocus
                  className="flex h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setConfirmation("");
                  }}
                  className="micro-press inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isMatch || isDeleting}
                  className="micro-press inline-flex items-center gap-1.5 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/30"
                >
                  {isDeleting ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
                  {isDeleting ? "Deleting…" : "Delete everything"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
