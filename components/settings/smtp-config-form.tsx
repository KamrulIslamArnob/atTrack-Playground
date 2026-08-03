"use client";

import { useState } from "react";
import { saveSmtpConfig, deleteSmtpConfig, type SmtpConfig } from "@/lib/actions/smtp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { Pencil, X, Trash2 } from "lucide-react";

interface SmtpConfigFormProps {
  config: SmtpConfig | null;
  onSetupGuide: () => void;
}

export function SmtpConfigForm({ config, onSetupGuide }: SmtpConfigFormProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [host, setHost] = useState(config?.host ?? "smtp.gmail.com");
  const [port, setPort] = useState(String(config?.port ?? 465));
  const [userEmail, setUserEmail] = useState(config?.user_email ?? "");
  const [password, setPassword] = useState("");

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);

    const result = await saveSmtpConfig({
      host,
      port: parseInt(port, 10),
      user_email: userEmail,
      password: password.replace(/\s/g, ""),
    });

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("SMTP configuration saved.");
      setIsEditing(false);
      setPassword("");
    }

    setPending(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    const result = await deleteSmtpConfig();
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("SMTP configuration removed.");
      setIsEditing(true);
      setHost("smtp.gmail.com");
      setPort("465");
      setUserEmail("");
      setPassword("");
    }
    setDeleting(false);
  };

  return (
    <div className="flex items-start justify-between">
      <div className="flex-1">
        {isEditing ? (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Use your Gmail App Password for secure sending.
              </p>
              <button
                type="button"
                onClick={onSetupGuide}
                className="text-xs text-primary hover:underline"
              >
                How to get an App Password
              </button>
            </div>
            <div className="grid grid-cols-[1fr_100px] gap-3">
              <div className="space-y-2">
                <Label htmlFor="smtp-host">SMTP Host</Label>
                <Input
                  id="smtp-host"
                  value={host}
                  className="h-10 bg-muted"
                  readOnly
                  tabIndex={-1}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp-port">Port</Label>
                <Input
                  id="smtp-port"
                  value={port}
                  className="h-10 bg-muted"
                  readOnly
                  tabIndex={-1}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="smtp-email">Gmail address</Label>
                <Input
                  id="smtp-email"
                  type="email"
                  name="smtp-email-field"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  placeholder="you@gmail.com"
                  className="h-10"
                  autoComplete="one-time-code"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp-password">App Password</Label>
                <Input
                  id="smtp-password"
                  type="password"
                  name="smtp-password-field"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={config ? "••••••••••••" : "16-character app password"}
                  className="h-10"
                  autoComplete="one-time-code"
                  required={!config}
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {config ? "Leave password blank to keep current." : "Never your regular Gmail password. Spaces are removed automatically."}
            </p>
            <div className="flex justify-end gap-2">
              {config && (
                <button
                  type="button"
                  onClick={() => { setIsEditing(false); setPassword(""); }}
                  className="inline-flex items-center gap-2 rounded-4xl border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  <X className="size-4" />
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={pending}
                className="inline-flex items-center justify-center rounded-4xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {pending && <Spinner className="mr-2" />}
                {config ? "Update" : "Save configuration"}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Gmail address</p>
                <p className="text-sm font-medium">{config?.user_email || "—"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">SMTP server</p>
                <p className="text-sm font-medium">{config?.host}:{config?.port}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {!isEditing && (
        <div className="ml-4 flex shrink-0 items-center gap-2">
          <button
            onClick={() => setIsEditing(true)}
            className="inline-flex items-center gap-2 rounded-4xl border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Pencil className="size-4" />
            {config ? "Edit" : "Set up"}
          </button>
          {config && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex items-center gap-2 rounded-4xl border border-border bg-background px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
            >
              {deleting ? <Spinner className="size-4" /> : <Trash2 className="size-4" />}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
