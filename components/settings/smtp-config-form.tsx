"use client";

import { useState } from "react";
import { saveSmtpConfig, deleteSmtpConfig, type SmtpConfig } from "@/lib/actions/smtp";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { XIcon } from "@/components/ui/x";

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
      toast.success("SMTP configuration saved");
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
      toast.success("SMTP configuration removed");
      setIsEditing(true);
      setHost("smtp.gmail.com");
      setPort("465");
      setUserEmail("");
      setPassword("");
    }
    setDeleting(false);
  };

  return (
    <div className="pt-1">
      {isEditing ? (
        <form onSubmit={handleSave} className="space-y-4 animate-in fade-in-50 duration-150">
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Use a Google App Password rather than your primary password.
            </p>
            <button
              type="button"
              onClick={onSetupGuide}
              className="text-xs font-medium text-primary hover:underline cursor-pointer"
            >
              How to get an App Password
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="smtp-email" className="text-xs font-medium text-foreground">
                Gmail address
              </Label>
              <Input
                id="smtp-email"
                type="email"
                name="smtp-email-field"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                placeholder="you@gmail.com"
                className="h-8.5 text-xs"
                autoComplete="one-time-code"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="smtp-password" className="text-xs font-medium text-foreground">
                App Password
              </Label>
              <Input
                id="smtp-password"
                type="password"
                name="smtp-password-field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={config ? "••••••••••••" : "16-character password"}
                className="h-8.5 text-xs"
                autoComplete="one-time-code"
                required={!config}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_100px]">
            <div className="space-y-1">
              <Label htmlFor="smtp-host" className="text-xs font-medium text-foreground">
                SMTP host
              </Label>
              <Input
                id="smtp-host"
                value={host}
                className="h-8.5 bg-muted/60 text-xs text-muted-foreground"
                readOnly
                tabIndex={-1}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="smtp-port" className="text-xs font-medium text-foreground">
                Port
              </Label>
              <Input
                id="smtp-port"
                value={port}
                className="h-8.5 bg-muted/60 text-xs text-muted-foreground"
                readOnly
                tabIndex={-1}
              />
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground">
            {config
              ? "Leave the password field blank to keep your currently saved credentials."
              : "Never enter your personal account password. Spaces are removed automatically."}
          </p>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
            {config && (
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setPassword("");
                }}
                className="micro-press inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted cursor-pointer"
              >
                <XIcon className="size-3" />
                <span>Cancel</span>
              </button>
            )}
            <button
              type="submit"
              disabled={pending}
              className="micro-press inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 cursor-pointer disabled:opacity-50"
            >
              {pending && <Spinner className="size-3" />}
              <span>{config ? "Save changes" : "Save configuration"}</span>
            </button>
          </div>
        </form>
      ) : config ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1 min-w-0">
            <div className="rounded-lg border border-border/40 bg-background/50 px-3 py-2">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70 leading-none">
                Gmail address
              </p>
              <p className="mt-0.5 truncate text-xs font-medium text-foreground">
                {config.user_email}
              </p>
            </div>
            <div className="rounded-lg border border-border/40 bg-background/50 px-3 py-2">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70 leading-none">
                SMTP server
              </p>
              <p className="mt-0.5 truncate text-xs font-medium text-foreground">
                {config.host}:{config.port}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 self-end sm:self-center">
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="micro-press inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted cursor-pointer"
            >
              <Pencil className="size-3" />
              <span>Edit</span>
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="micro-press inline-flex items-center justify-center rounded-lg border border-border/80 bg-background size-7 text-destructive transition-colors hover:bg-destructive/10 cursor-pointer disabled:opacity-50"
              title="Remove SMTP configuration"
            >
              {deleting ? <Spinner className="size-3" /> : <Trash2 className="size-3" />}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground leading-relaxed">
            No SMTP account configured. Connect Gmail to send job inquiries, applications, and follow-ups directly from BetterJob.
          </p>
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="micro-press shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted cursor-pointer"
          >
            <Pencil className="size-3" />
            <span>Set up SMTP</span>
          </button>
        </div>
      )}
    </div>
  );
}
