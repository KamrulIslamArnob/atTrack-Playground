import Link from "next/link";
import { getUser } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default async function ApplicationsPage() {
  const { supabase, userId } = await getUser();

  const { data: applications } = await supabase
    .from("applications")
    .select("id, status, applied_at, created_at, job:jobs(id, title, company:companies(name, location))")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="-mx-6 border-b border-border pb-6">
        <div className="flex items-center justify-between px-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Applications</h1>
            <p className="text-sm text-muted-foreground">
              Track and manage your job applications.
            </p>
          </div>
          <Link href="/applications/new" className={buttonVariants({ size: "sm" })}>
            <Plus className="mr-1 size-4" />
            Add Job
          </Link>
        </div>
      </div>

      {applications && applications.length > 0 ? (
        <div className="rounded-4xl border border-border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Role</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Company</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Location</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Applied</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => {
                const job = app.job as unknown as Record<string, unknown> | null;
                const company = job?.company as unknown as Record<string, unknown> | null;
                return (
                  <tr key={app.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <Link href={`/applications/${app.id}`} className="text-sm font-medium hover:underline">
                        {(job?.title as string) ?? "Untitled"}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {(company?.name as string) ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {(company?.location as string) ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-xs">
                        {app.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {app.applied_at ? new Date(app.applied_at).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-4xl border border-dashed border-border p-12 text-center">
          <p className="text-sm text-muted-foreground">No applications yet.</p>
          <Link href="/applications/new" className={buttonVariants({ size: "sm", className: "mt-4" })}>
            <Plus className="mr-1 size-4" />
            Add your first job
          </Link>
        </div>
      )}
    </div>
  );
}
