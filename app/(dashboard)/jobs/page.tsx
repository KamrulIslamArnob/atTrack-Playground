import { getJobsList } from "@/lib/actions/jobs-list";
import { JobsGrid } from "@/components/jobs-grid";
import { ImportChoice } from "@/components/import-choice";
import { Breadcrumbs } from "@/components/breadcrumbs";

interface PageProps {
  searchParams: Promise<{
    search?: string;
    status?: string;
    sort?: string;
    page?: string;
    perPage?: string;
  }>;
}

export default async function JobsPage(props: PageProps) {
  const params = await props.searchParams;

  const search = params.search ?? "";
  const status = params.status ?? "all";
  const sort = params.sort ?? "newest";
  const page = Number(params.page) || 1;
  const perPage = Number(params.perPage) || 30;

  const result = await getJobsList({
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
            <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
            <p className="text-sm text-muted-foreground">
              Track and manage your job opportunities.
            </p>
          </div>
          <div className="flex items-center">
            <ImportChoice />
          </div>
        </div>
      </div>

      <Breadcrumbs />

      <JobsGrid
        jobs={result.jobs}
        total={result.total}
        initialSearch={search}
        initialStatus={status}
        initialSort={sort}
        page={result.page}
        totalPages={result.totalPages}
        perPage={result.perPage}
      />
    </div>
  );
}
