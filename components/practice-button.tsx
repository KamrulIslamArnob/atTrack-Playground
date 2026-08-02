"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MCQTest } from "@/components/mcq-test";
import { Brain } from "lucide-react";

interface PracticeButtonProps {
  jobId: string;
}

export function PracticeButton({ jobId }: PracticeButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Brain className="mr-1 size-4" />
        Practice
      </Button>

      {open && <MCQTest jobId={jobId} onClose={() => setOpen(false)} />}
    </>
  );
}
