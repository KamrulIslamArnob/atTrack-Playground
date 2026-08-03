"use client";

import { useState } from "react";
import { DocumentsUpload } from "@/components/documents-upload";
import { buttonVariants } from "@/components/ui/button";
import { Upload } from "lucide-react";

export function DocumentsUploadInline() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={buttonVariants({ size: "sm" })}
      >
        <Upload className="mr-1 size-4" />
        Upload
      </button>
      <DocumentsUpload open={open} onOpenChange={setOpen} />
    </>
  );
}
