import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { FileTextIcon } from "@/components/ui/file-text";
import { Breadcrumbs } from "@/components/breadcrumbs";
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
    <div className="space-y-6">
      <div className="-mx-6 border-b border-border pb-6">
        <div className="px-6">
          <Link href="/documents" className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="size-4" /> Back to Resume/CV
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-gradient-brand text-primary-foreground">
              <FileTextIcon className="size-5" />
            </div>
            <div>
              <h1 className="font-heading text-2xl font-semibold tracking-tight">Editable resume template</h1>
              <p className="text-sm text-muted-foreground sm:text-base">A Letter-size resume editor faithful to the supplied LaTeX layout.</p>
            </div>
          </div>
        </div>
      </div>

      <Breadcrumbs />
      <ResumeBuilderEditor id={document.id} initialName={document.name} initialDocument={document.builder_data} />
    </div>
  );
}
