import { notFound } from "next/navigation";
import { ResumePreview } from "@/lib/resume/render-html";
import { getResumeBuilderDocument } from "@/lib/actions/resume-builder";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PrintResumePage({ params }: PageProps) {
  const { id } = await params;
  const document = await getResumeBuilderDocument(id);
  if (!document) notFound();

  return (
    <>
      <style>{`
        @page { size: letter; margin: 0; }
        html, body { margin: 0; padding: 0; background: #fff; }
        @media print {
          body { background: #fff; }
          .resume-preview { margin: 0 !important; box-shadow: none !important; }
        }
      `}</style>
      <ResumePreview document={document.builder_data} />
    </>
  );
}
