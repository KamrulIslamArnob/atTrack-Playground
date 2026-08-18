import { getDocuments } from "@/lib/actions/documents";
import { DocumentsList } from "@/components/documents-list";

export default async function DocumentsPage() {
  const documents = await getDocuments();

  return (
    <div className="flex-1 h-full overflow-y-auto min-h-0 px-6 pb-8">
      <DocumentsList documents={documents} />
    </div>
  );
}
