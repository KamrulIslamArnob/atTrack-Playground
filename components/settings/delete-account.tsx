"use client";

import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { deleteAccount } from "@/lib/actions/auth";

interface DeleteAccountProps {
  email: string;
}

export function DeleteAccount({ email }: DeleteAccountProps) {
  const [open, setOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const isMatch = confirmEmail === email;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isMatch) return;
    setIsDeleting(true);
    const formData = new FormData();
    formData.append("email", confirmEmail);
    await deleteAccount(formData);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-4xl border border-destructive/30 bg-destructive/5 px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
      >
        <AlertTriangle className="size-4" />
        Delete account
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-4xl bg-card p-6 shadow-md ring-1 ring-foreground/5">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="size-5 text-destructive" />
              </div>
              <div>
                <h2 className="font-heading text-base font-medium text-card-foreground">
                  Delete account
                </h2>
                <p className="text-sm text-muted-foreground">
                  This action cannot be undone
                </p>
              </div>
            </div>

            <p className="mt-4 text-sm text-muted-foreground">
              This will permanently delete your account, including all your data,
              applications, documents, and profile information.
            </p>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="space-y-3">
                <label htmlFor="confirm-email" className="text-sm font-medium">
                  Type <span className="inline-flex items-center rounded-4xl bg-muted px-2 py-0.5 font-mono text-sm text-foreground">{email}</span> to confirm
                </label>
                <input
                  id="confirm-email"
                  type="email"
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="mt-2 flex h-10 w-full rounded-4xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setConfirmEmail("");
                  }}
                  className="inline-flex items-center justify-center rounded-4xl border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isMatch || isDeleting}
                  className="inline-flex items-center gap-2 rounded-4xl bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeleting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <AlertTriangle className="size-4" />
                  )}
                  Delete account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
