import Link from "next/link";
import { getUser } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Briefcase, Bookmark, Calendar, Clock } from "lucide-react";

export default async function OverviewPage() {
  const { supabase, userId } = await getUser();

  const { data: applications } = await supabase
    .from("applications")
    .select("id, status, created_at, job:jobs(id, title, company:companies(name))")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(5);

  const { count: savedCount } = await supabase
    .from("jobs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "saved");

  const { count: appliedCount } = await supabase
    .from("applications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "submitted");

  const { count: interviewingCount } = await supabase
    .from("applications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "interviewing");

  const { data: upcomingInterviews } = await supabase
    .from("interviews")
    .select("id, scheduled_at, type, application:applications(id, job:jobs(title, company:companies(name)))")
    .eq("user_id", userId)
    .gte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(3);

  const stats = [
    { name: "Saved", value: savedCount ?? 0, icon: Bookmark, color: "text-muted-foreground" },
    { name: "Applied", value: appliedCount ?? 0, icon: Briefcase, color: "text-primary" },
    { name: "Interviewing", value: interviewingCount ?? 0, icon: Calendar, color: "text-primary" },
  ];

  return (
    <div className="space-y-8">
      <div className="-mx-6 border-b border-border pb-6">
        <div className="px-6">
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="text-sm text-muted-foreground">
            What requires your attention right now.
          </p>
        </div>
      </div>

      <Breadcrumbs />

      <div className="grid grid-cols-3 gap-4">
        {stats.map((stat) => (
          <Card key={stat.name}>
            <CardContent className="flex items-center gap-4 p-4">
              <stat.icon className={`size-5 ${stat.color}`} />
              <div>
                <p className="text-2xl font-semibold">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.name}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-muted-foreground">Recent Applications</h2>
            <Link href="/jobs" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </div>
          {applications && applications.length > 0 ? (
            <div className="space-y-2">
              {applications.map((app) => {
                const job = app.job as unknown as Record<string, unknown> | null;
                const company = job?.company as unknown as Record<string, unknown> | null;
                return (
                  <Link
                    key={app.id}
                    href={`/jobs/${app.id}`}
                    className="flex items-center justify-between rounded-4xl border border-border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {(job?.title as string) ?? "Untitled"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(company?.name as string) ?? "Unknown company"}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {app.status}
                    </Badge>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No applications yet.</p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-muted-foreground">Upcoming Interviews</h2>
            <Link href="/interviews" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </div>
          {upcomingInterviews && upcomingInterviews.length > 0 ? (
            <div className="space-y-2">
              {upcomingInterviews.map((interview) => {
                const app = interview.application as unknown as Record<string, unknown> | null;
                const job = app?.job as unknown as Record<string, unknown> | null;
                return (
                    <div key={interview.id} className="rounded-4xl border border-border p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">
                        {(job?.title as string) ?? "Interview"}
                      </p>
                      <Badge variant="outline" className="text-xs">
                        {interview.type as string}
                      </Badge>
                    </div>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="size-3" />
                      {new Date(interview.scheduled_at).toLocaleDateString()}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No upcoming interviews.</p>
          )}
        </div>
      </div>
    </div>
  );
}
