import { redirect } from "next/navigation";
import Link from "next/link";
import { getUser } from "@/lib/auth";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { PdfViewer } from "@/components/pdf-viewer";
import { TextDocumentViewer } from "@/components/text-document-viewer";
import { getDocumentDetails } from "@/lib/actions/documents";
import { ArrowLeft, FileText, Sparkles } from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function DocumentPage(props: PageProps) {
  const { id } = await props.params;
  const result = await getDocumentDetails(id);

  if (!result) {
    redirect("/documents");
  }

  const { document: doc, job } = result;

  if (doc.builder_data) {
    redirect(`/documents/builder/${id}`);
  }

  if (doc.generated_kind === "external_link") {
    redirect(doc.file_path);
  }

  // Check if this document has text content (AI generated, cover letter, text notes)
  const isTextDocument =
    (doc.content && doc.content.trim().length > 0) ||
    doc.file_path.startsWith("generated/") ||
    doc.generated_kind != null;

  if (isTextDocument) {
    return (
      <div className="space-y-6">
        <div className="-mx-6 border-b border-border pb-6">
          <div className="flex items-center justify-between px-6">
            <div>
              <Link
                href="/documents"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
              >
                <ArrowLeft className="size-4" />
                Back to documents
              </Link>
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-2xl bg-muted text-primary">
                  {doc.generated_kind ? (
                    <Sparkles className="size-5 text-purple-500" />
                  ) : (
                    <FileText className="size-5 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">{doc.name}</h1>
                  <p className="text-sm text-muted-foreground">
                    {doc.generated_kind
                      ? doc.generated_kind.replace(/_/g, " ")
                      : doc.type === "cover_letter"
                        ? "Cover Letter"
                        : "Text Document"}
                    {doc.is_default && " · Default"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Breadcrumbs />

        <TextDocumentViewer doc={doc} job={job} />
      </div>
    );
  }

  // Get URL for physical PDF files (direct public path or signed URL fallback)
  const { supabase } = await getUser();
  let pdfUrl = doc.file_path;
  if (!doc.file_path.startsWith("/resume/")) {
    const { data: urlData } = await supabase.storage
      .from("documents")
      .createSignedUrl(doc.file_path, 60 * 60);

    if (urlData?.signedUrl) {
      pdfUrl = urlData.signedUrl;
    }
  }

  if (!pdfUrl) {
    redirect("/documents");
  }

  return (
    <div className="space-y-6">
      <div className="-mx-6 border-b border-border pb-6">
        <div className="flex items-center justify-between px-6">
          <div>
            <Link
              href="/documents"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
            >
              <ArrowLeft className="size-4" />
              Back to documents
            </Link>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-muted">
                <FileText className="size-5 text-muted-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">{doc.name}</h1>
                <p className="text-sm text-muted-foreground">
                  {doc.type === "resume" ? "Resume" : doc.type === "cover_letter" ? "Cover Letter" : "Document"}
                  {doc.is_default && " · Default"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Breadcrumbs />

      <PdfViewer url={pdfUrl} fileName={doc.name} />
    </div>
  );
}
