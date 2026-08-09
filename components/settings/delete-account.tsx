"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
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
        className="inline-flex items-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
      >
        <AlertTriangle className="size-4" />
        Delete all data
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-card p-6 shadow-md ring-1 ring-foreground/5 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="size-5 text-destructive" />
              </div>
              <div>
                <h2 className="font-heading text-base font-medium text-card-foreground">
                  Delete all data
                </h2>
                <p className="text-sm text-muted-foreground">
                  This action cannot be undone
                </p>
              </div>
            </div>

            <p className="mt-4 text-sm text-muted-foreground">
              This permanently deletes everything stored in this workspace:
            </p>

            <ul className="mt-3 space-y-1.5">
              {dataItems.map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Trash2 className="size-3.5 shrink-0 text-destructive/60" />
                  {item}
                </li>
              ))}
            </ul>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div className="space-y-3">
                <label htmlFor="confirm-phrase" className="text-sm font-medium">
                  Type{" "}
                  <span className="inline-flex items-center rounded-2xl bg-muted px-2 py-0.5 font-mono text-sm text-foreground">
                    {confirmPhrase}
                  </span>{" "}
                  to confirm
                </label>
                <input
                  id="confirm-phrase"
                  type="text"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  placeholder="Enter the text above"
                  className="mt-2 flex h-10 w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setConfirmation("");
                  }}
                  className="inline-flex items-center justify-center rounded-2xl border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isMatch || isDeleting}
                  className="inline-flex items-center gap-2 rounded-2xl bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeleting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <AlertTriangle className="size-4" />
                  )}
                  Delete everything
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
