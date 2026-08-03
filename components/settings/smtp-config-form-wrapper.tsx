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
    <>
      <SmtpConfigForm config={config} onSetupGuide={() => setGuideOpen(true)} />
      <AppPasswordGuide open={guideOpen} onOpenChange={setGuideOpen} />
    </>
  );
}
