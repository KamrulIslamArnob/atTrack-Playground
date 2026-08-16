"use client";

import { Folder } from "lucide-react";
import { UsersIcon } from "@/components/ui/users";
import { FileTextIcon } from "@/components/ui/file-text";
import { ContactsTab } from "@/components/job-detail/tabs/contacts-tab";
import { DocumentsTab } from "@/components/job-detail/tabs/documents-tab";
import { NotesTab } from "@/components/job-detail/tabs/notes-tab";
import type { JobDetailData } from "@/lib/types/job-detail";

interface NetworkTabProps {
  data: JobDetailData;
  onRefresh: () => void;
}

/**
 * "Who do I know here, and what do I send them?" is one task, so contacts,
 * assets and research notes share a scroll column instead of three tabs.
 * Each section keeps its own state and server actions.
 */
export function NetworkTab({ data, onRefresh }: NetworkTabProps) {
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-foreground/90">
          <UsersIcon className="size-3.5 text-indigo-500" /> Contacts
        </h3>
        <ContactsTab data={data} onRefresh={onRefresh} />
      </section>

      <section className="space-y-3 border-t border-border/60 pt-6">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-foreground/90">
          <Folder className="size-3.5 text-orange-500" /> Documents & links
        </h3>
        <DocumentsTab data={data} onRefresh={onRefresh} />
      </section>

      <section className="space-y-3 border-t border-border/60 pt-6">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-foreground/90">
          <FileTextIcon className="size-3.5 text-sky-500" /> Notes
        </h3>
        <NotesTab data={data} onRefresh={onRefresh} />
      </section>
    </div>
  );
}
