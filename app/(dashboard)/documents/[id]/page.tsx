import { redirect } from "next/navigation";
import Link from "next/link";
import { getUser } from "@/lib/auth";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { PdfViewer } from "@/components/pdf-viewer";
import { ArrowLeft, FileText } from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function DocumentPage(props: PageProps) {
  const { id } = await props.params;
  const { supabase, userId } = await getUser();

  const { data: doc } = await supabase
    .from("documents")
    .select("id, name, type, file_path, content, is_default, match_data, created_at")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (!doc) {
    redirect("/documents");
  }

  // Get URL for the PDF (direct public path or signed URL fallback)
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
