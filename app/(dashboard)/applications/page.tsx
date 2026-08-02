import { Suspense } from "react";
import { getApplications } from "@/lib/actions/applications";
import { ApplicationsGrid } from "@/components/applications-grid";
import { AddJobDialog } from "@/components/add-job-dialog";
import { Pagination } from "@/components/pagination";

interface PageProps {
  searchParams: Promise<{
    search?: string;
    status?: string;
    sort?: string;
    page?: string;
    perPage?: string;
  }>;
}

export default async function ApplicationsPage(props: PageProps) {
  const params = await props.searchParams;

  const search = params.search ?? "";
  const status = params.status ?? "all";
  const sort = params.sort ?? "newest";
  const page = Number(params.page) || 1;
  const perPage = Number(params.perPage) || 30;

  const result = await getApplications({
    search,
    status,
    sort,
    page,
    perPage,
  });

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
          <AddJobDialog />
        </div>
      </div>

      <ApplicationsGrid
        applications={result.applications}
        total={result.total}
        initialSearch={search}
        initialStatus={status}
        initialSort={sort}
      />

      {result.totalPages > 1 && (
        <Suspense>
          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            perPage={result.perPage}
          />
        </Suspense>
      )}
    </div>
  );
}
