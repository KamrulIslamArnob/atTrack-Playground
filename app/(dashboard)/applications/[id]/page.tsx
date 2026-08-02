import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, ExternalLink, MapPin, DollarSign } from "lucide-react";

export default async function ApplicationDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const { supabase, userId } = await getUser();

  const { data: application } = await supabase
    .from("applications")
    .select("*, job:jobs(*, company:companies(*))")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (!application) {
    redirect("/applications");
  }

  const job = application.job as Record<string, unknown> | null;
  const company = job?.company as Record<string, unknown> | null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/applications" className={buttonVariants({ variant: "ghost", size: "icon" })}>
          <ArrowLeft className="size-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {(job?.title as string) ?? "Untitled"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {(company?.name as string) ?? "Unknown company"}
          </p>
        </div>
        <Badge variant="outline">{application.status}</Badge>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Location</p>
                <p className="mt-1 flex items-center gap-1 text-sm font-medium">
                  <MapPin className="size-3" />
                  {(job?.location as string) ?? "Not specified"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Salary</p>
                <p className="mt-1 flex items-center gap-1 text-sm font-medium">
                  <DollarSign className="size-3" />
                  {job?.salary_min && job?.salary_max
                    ? `${job.salary_min} - ${job.salary_max}`
                    : "Not specified"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">URL</p>
                {job?.url ? (
                  <a
                    href={job.url as string}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    View posting <ExternalLink className="size-3" />
                  </a>
                ) : (
                  <p className="mt-1 text-sm font-medium">Not specified</p>
                )}
              </CardContent>
            </Card>
          </div>

          {'description' in (job ?? {}) && typeof job?.description === 'string' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Job Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {job.description as unknown as string}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
              <button className={buttonVariants({ size: "sm", className: "mt-4" })}>
                Upload document
              </button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline">
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <p className="text-sm text-muted-foreground">No timeline events yet.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes">
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <p className="text-sm text-muted-foreground">No notes yet.</p>
              <button className={buttonVariants({ size: "sm", className: "mt-4" })}>
                Add note
              </button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
