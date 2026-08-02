import Link from "next/link";
import { getUser } from "@/lib/auth";
import { buttonVariants } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default async function SavedJobsPage() {
  const { supabase, userId } = await getUser();

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, title, location, status, created_at, company:companies(name)")
    .eq("user_id", userId)
    .eq("status", "saved")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Saved Jobs</h1>
          <p className="text-sm text-muted-foreground">
            Jobs you&apos;ve saved for later.
          </p>
        </div>
        <Link href="/applications/new" className={buttonVariants({ size: "sm" })}>
          <Plus className="mr-1 size-4" />
          Add Job
        </Link>
      </div>

      {jobs && jobs.length > 0 ? (
        <div className="border rounded-lg">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Role</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Company</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Location</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Saved</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-b last:border-0 hover:bg-muted/50">
                  <td className="px-4 py-3">
                    <Link href={`/applications/${job.id}`} className="text-sm font-medium hover:underline">
                      {job.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {(job.company as unknown as Record<string, unknown>)?.name as string ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {job.location ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {new Date(job.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">No saved jobs yet.</p>
          <Link href="/applications/new" className={buttonVariants({ size: "sm", className: "mt-4" })}>
            <Plus className="mr-1 size-4" />
            Add a job
          </Link>
        </div>
      )}
    </div>
  );
}
