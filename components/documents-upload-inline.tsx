"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DocumentsUpload } from "@/components/documents-upload";
import { buttonVariants } from "@/components/ui/button";
import { createResumeBuilderDocument } from "@/lib/actions/resume-builder";
import { FilePenLine, Loader2, Upload } from "lucide-react";

export function DocumentsUploadInline() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const createTemplate = () => {
    startTransition(async () => {
      const { id } = await createResumeBuilderDocument();
      router.push(`/documents/builder/${id}`);
    });
  };

  return (
    <div className="flex items-center gap-2">
      <button onClick={createTemplate} disabled={isPending} className={buttonVariants({ size: "sm", variant: "outline" })}>
        {isPending ? <Loader2 className="mr-1 size-4 animate-spin" /> : <FilePenLine className="mr-1 size-4" />}
        Build from template
      </button>
      <button onClick={() => setOpen(true)} className={buttonVariants({ size: "sm" })}>
        <Upload className="mr-1 size-4" />
        Upload
      </button>
      <DocumentsUpload open={open} onOpenChange={setOpen} />
    </div>
  );
}
