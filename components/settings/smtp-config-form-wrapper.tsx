"use client";

import { useState } from "react";
import { SmtpConfigForm } from "@/components/settings/smtp-config-form";
import { AppPasswordGuide } from "@/components/settings/app-password-guide";
import type { SmtpConfig } from "@/lib/actions/smtp";

interface SmtpConfigFormWrapperProps {
  config: SmtpConfig | null;
}

export function SmtpConfigFormWrapper({ config }: SmtpConfigFormWrapperProps) {
  const [guideOpen, setGuideOpen] = useState(false);

  return (
    <section
      aria-labelledby="email-heading"
      className="rounded-2xl bg-muted p-4 sm:p-5"
    >
      <div className="mb-3">
        <h2 id="email-heading" className="text-sm font-semibold tracking-tight text-foreground">
          Email configuration (SMTP)
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Send job applications and outreach emails directly using your own Gmail or SMTP server
        </p>
      </div>
      <SmtpConfigForm config={config} onSetupGuide={() => setGuideOpen(true)} />
      <AppPasswordGuide open={guideOpen} onOpenChange={setGuideOpen} />
    </section>
  );
}
