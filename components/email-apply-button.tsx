"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";

interface EmailApplyButtonProps {
  jobId: string;
  isSmtpConfigured: boolean;
}

export function EmailApplyButton({ jobId, isSmtpConfigured }: EmailApplyButtonProps) {
  const router = useRouter();

  const handleClick = () => {
    if (!isSmtpConfigured) {
      toast.error("SMTP not configured", {
        description: "Set up your email in Settings to send applications directly.",
        action: {
          label: "Go to Settings",
          onClick: () => router.push("/settings"),
        },
        duration: 6000,
      });
      return;
    }

    router.push(`/jobs/${jobId}/application`);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2"
      onClick={handleClick}
    >
      <Mail className="size-3.5" />
      Email application
    </Button>
  );
}
