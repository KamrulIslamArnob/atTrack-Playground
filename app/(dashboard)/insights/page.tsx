import { getUser } from "@/lib/auth";

export default async function InsightsPage() {
  await getUser();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Insights</h1>
        <p className="text-sm text-muted-foreground">
          Analytics and patterns from your job search.
        </p>
      </div>

      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
        <p className="text-sm text-muted-foreground">
          Insights will appear here as you add more applications.
        </p>
      </div>
    </div>
  );
}
