"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DocumentsAddDialog } from "@/components/documents-add-dialog";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InfoTooltip } from "@/components/ui/tooltip";
import { createResumeBuilderDocument } from "@/lib/actions/resume-builder";
import { FilePenLine, Loader2, Code2 } from "lucide-react";
import { UploadIcon } from "@/components/ui/upload";
import { Link2Icon } from "@/components/ui/link-2";
import { PlusIcon } from "@/components/ai-chatbot/plus-icon";
import { ChevronDownIcon } from "@/components/ui/chevron-down";

export function DocumentsUploadInline() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"upload" | "link" | "tex">("upload");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const createTemplate = () => {
    startTransition(async () => {
      const { id } = await createResumeBuilderDocument();
      router.push(`/documents/builder/${id}`);
    });
  };

  const handleOpenTab = (tab: "upload" | "link" | "tex") => {
    setActiveTab(tab);
    setOpen(true);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={createTemplate}
        disabled={isPending}
        className={buttonVariants({ size: "sm", variant: "outline" })}
      >
        {isPending ? <Loader2 className="mr-1 size-4 animate-spin" /> : <FilePenLine className="mr-1 size-4" />}
        Build from template
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger className={buttonVariants({ size: "sm" })}>
          <PlusIcon className="mr-1 size-4" />
          Add Resume
          <ChevronDownIcon className="ml-1 size-3.5 opacity-70" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52 rounded-xl">
          <DropdownMenuItem onClick={() => handleOpenTab("upload")} className="gap-2 cursor-pointer">
            <UploadIcon className="size-4 text-muted-foreground" />
            Upload PDF
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleOpenTab("link")} className="gap-2 cursor-pointer">
            <Link2Icon className="size-4 text-muted-foreground" />
            External Link
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleOpenTab("tex")} className="justify-between cursor-pointer">
            <div className="flex items-center gap-2">
              <Code2 className="size-4 text-muted-foreground" />
              <span>.TEX Code</span>
            </div>
            <InfoTooltip
              content="LaTeX Source Code: Import raw .tex code to edit structure inline, generate live letter-size previews, and compile clean PDFs."
              side="left"
            />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DocumentsAddDialog open={open} onOpenChange={setOpen} defaultTab={activeTab} />
    </div>
  );
}
