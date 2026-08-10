"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { deleteDocument, setDefaultDocument, getSignedUrl } from "@/lib/actions/documents";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { FileText, Download, Trash2, Star } from "lucide-react";
import type { Document } from "@/lib/actions/documents";

interface DocumentsListProps {
  documents: Document[];
}

const typeLabels: Record<string, string> = {
  resume: "Resume",
  cover_letter: "Cover Letter",
  other: "Other",
};

const typeColors: Record<string, string> = {
  resume: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  cover_letter: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  other: "bg-muted text-muted-foreground",
};

export function DocumentsList({ documents }: DocumentsListProps) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const router = useRouter();

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setPendingId(id);
    try {
      await deleteDocument(id);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setPendingId(null);
    }
  };

  const handleSetDefault = async (id: string) => {
    setPendingId(id);
    try {
      await setDefaultDocument(id);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to set default");
    } finally {
      setPendingId(null);
    }
  };

  const handleDownload = async (filePath: string, name: string) => {
    try {
      const url = filePath.startsWith("/") ? filePath : await getSignedUrl(filePath);
      const a = document.createElement("a");
      a.href = url;
      a.download = name.endsWith(".pdf") ? name : `${name}.pdf`;
      a.click();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to download");
    }
  };

  if (documents.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-border overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground w-10">#</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Uploaded</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">AI Extracted</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc, index) => (
            <tr
              key={doc.id}
              className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
            >
              <td className="px-4 py-3 text-muted-foreground text-xs">
                {index + 1}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <FileText className="size-4 text-muted-foreground shrink-0" />
                  <Link
                    href={`/documents/${doc.id}`}
                    className="font-medium hover:text-primary transition-colors"
                  >
                    {doc.name}
                  </Link>
                  {doc.is_default && (
                    <span className="inline-flex items-center gap-1 rounded-2xl bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                      <Star className="size-2.5" />
                      Default
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-block rounded-2xl px-2 py-0.5 text-[10px] font-medium ${typeColors[doc.type] ?? "bg-muted text-muted-foreground"}`}
                >
                  {typeLabels[doc.type] ?? doc.type}
                </span>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {new Date(doc.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </td>
              <td className="px-4 py-3">
                {doc.match_data ? (
                  <span className="text-xs text-muted-foreground">
                    {doc.match_data.skills.length} skills, {doc.match_data.experience.length} roles
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground/50">-</span>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1">
                  {doc.type === "resume" && !doc.is_default && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1"
                      onClick={() => handleSetDefault(doc.id)}
                      disabled={pendingId === doc.id}
                    >
                      {pendingId === doc.id ? (
                        <Spinner className="size-3" />
                      ) : (
                        <Star className="size-3.5" />
                      )}
                      Set default
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1"
                    onClick={() => handleDownload(doc.file_path, doc.name)}
                  >
                    <Download className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(doc.id, doc.name)}
                    disabled={pendingId === doc.id}
                  >
                    {pendingId === doc.id ? (
                      <Spinner className="size-3" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
