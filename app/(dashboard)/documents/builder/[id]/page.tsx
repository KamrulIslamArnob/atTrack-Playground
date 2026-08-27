import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { FileTextIcon } from "@/components/ui/file-text";
import { InfoTooltip } from "@/components/ui/tooltip";
import { ResumeBuilderEditor } from "@/components/resume-builder/resume-builder-editor";
import { getResumeBuilderDocument } from "@/lib/actions/resume-builder";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ResumeBuilderPage({ params }: PageProps) {
  const { id } = await params;
  const document = await getResumeBuilderDocument(id);
  if (!document) notFound();

  return (
    <div className="flex flex-col min-h-full pb-16">
      {/* Header Banner */}
      <div className="w-full border-b border-border/80 bg-background/50 px-4 sm:px-6 py-4">
        <div className="flex flex-col gap-3 max-w-[1720px] mx-auto">
          <div>
            <Link
              href="/documents"
              className="group inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronLeft className="size-3.5 transition-transform duration-150 group-hover:-translate-x-0.5" />
              <span>Back to Documents & Resumes</span>
            </Link>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-gradient-brand text-primary-foreground shadow-xs shrink-0 ring-1 ring-white/20 dark:ring-white/10">
                <FileTextIcon className="size-5" />
              </div>
              <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
                <h1 className="font-heading text-xl sm:text-2xl font-semibold tracking-tight whitespace-nowrap">
                  Editable Resume Template
                </h1>
                <InfoTooltip
                  content="A Letter-size resume editor faithful to the dual HTML & LaTeX render layout."
                  side="right"
                  iconClassName="size-4"
                />
                <span className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-muted/60 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                  LaTeX Engine
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full px-4 sm:px-6 py-5 max-w-[1720px] mx-auto">
        <ResumeBuilderEditor id={document.id} initialName={document.name} initialDocument={document.builder_data} />
      </div>
    </div>
  );
}
