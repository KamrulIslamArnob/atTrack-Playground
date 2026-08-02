import { getUser } from "@/lib/auth";
import { buttonVariants } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { FileText, Upload } from "lucide-react";

export default async function DocumentsPage() {
  const { supabase, userId } = await getUser();

  const { data: documents } = await supabase
    .from("documents")
    .select("id, name, type, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

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
          <button className={buttonVariants({ size: "sm" })}>
            <Upload className="mr-1 size-4" />
            Upload
          </button>
        </div>
      </div>

      <Breadcrumbs />

      {documents && documents.length > 0 ? (
        <div className="rounded-4xl border border-border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Type</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id} className="border-b last:border-0 hover:bg-muted/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileText className="size-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{doc.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground capitalize">
                    {doc.type.replace("_", " ")}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {new Date(doc.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-4xl border border-dashed border-border p-12 text-center">
          <FileText className="size-10 text-muted-foreground/50" />
          <p className="mt-4 text-sm text-muted-foreground">No documents uploaded yet.</p>
          <button className={buttonVariants({ size: "sm", className: "mt-4" })}>
            <Upload className="mr-1 size-4" />
            Upload your first document
          </button>
        </div>
      )}
    </div>
  );
}
