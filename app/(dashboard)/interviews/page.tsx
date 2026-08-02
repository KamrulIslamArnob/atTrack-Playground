import { getUser } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Calendar, Clock } from "lucide-react";

export default async function InterviewsPage() {
  const { supabase, userId } = await getUser();

  const { data: interviews } = await supabase
    .from("interviews")
    .select("id, scheduled_at, type, location, notes, application:applications(id, job:jobs(title, company:companies(name)))")
    .eq("user_id", userId)
    .order("scheduled_at", { ascending: true });

  return (
    <div className="space-y-6">
      <div className="-mx-6 border-b border-border pb-6">
        <div className="px-6">
          <h1 className="text-2xl font-semibold tracking-tight">Interviews</h1>
          <p className="text-sm text-muted-foreground">
            Your upcoming and past interviews.
          </p>
        </div>
      </div>

      <Breadcrumbs />

      {interviews && interviews.length > 0 ? (
        <div className="space-y-3">
          {interviews.map((interview) => {
            const app = interview.application as unknown as Record<string, unknown> | null;
            const job = app?.job as unknown as Record<string, unknown> | null;
            const company = job?.company as unknown as Record<string, unknown> | null;

            return (
              <div key={interview.id} className="flex items-center justify-between rounded-4xl border border-border p-4">
                <div className="flex items-center gap-4">
                  <Calendar className="size-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">
                      {(job?.title as string) ?? "Interview"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(company?.name as string) ?? "Unknown company"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="flex items-center gap-1 text-sm">
                      <Clock className="size-3" />
                      {new Date(interview.scheduled_at).toLocaleDateString()}
                    </p>
                    {interview.location && (
                      <p className="text-xs text-muted-foreground">{interview.location}</p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {(interview.type as string) ?? "TBD"}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-4xl border border-dashed border-border p-12 text-center">
          <p className="text-sm text-muted-foreground">No interviews scheduled yet.</p>
        </div>
      )}
    </div>
  );
}
