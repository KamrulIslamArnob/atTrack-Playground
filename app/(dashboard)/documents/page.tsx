import { getDocuments } from "@/lib/actions/documents";
import { DocumentsList } from "@/components/documents-list";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { DocumentsUploadInline } from "@/components/documents-upload-inline";

export default async function DocumentsPage() {
  const documents = await getDocuments();

  return (
    <div className="space-y-6">
      <div className="-mx-6 border-b border-border pb-6">
        <div className="flex items-center justify-between px-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
            <p className="text-sm text-muted-foreground">
              Your resumes, cover letters, and other files.
            </p>
          </div>
          <DocumentsUploadInline />
        </div>
      </div>

      <Breadcrumbs />

      {documents.length > 0 ? (
        <DocumentsList documents={documents} />
      ) : (
        <div className="flex flex-col items-center justify-center rounded-4xl border border-dashed border-border p-12 text-center">
          <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Upload resumes for AI-powered job matching.
          </p>
        </div>
      )}
    </div>
  );
}
