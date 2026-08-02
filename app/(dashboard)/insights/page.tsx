import { getUser } from "@/lib/auth";
import { Breadcrumbs } from "@/components/breadcrumbs";

export default async function InsightsPage() {
  await getUser();

  return (
    <div className="space-y-6">
      <div className="-mx-6 border-b border-border pb-6">
        <div className="px-6">
          <h1 className="text-2xl font-semibold tracking-tight">Insights</h1>
          <p className="text-sm text-muted-foreground">
            Analytics and patterns from your job search.
          </p>
        </div>
      </div>

      <Breadcrumbs />

      <div className="flex flex-col items-center justify-center rounded-4xl border border-dashed border-border p-12 text-center">
        <p className="text-sm text-muted-foreground">
          Insights will appear here as you add more applications.
        </p>
      </div>
    </div>
  );
}
