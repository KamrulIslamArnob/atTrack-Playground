import { getApplications } from "@/lib/actions/applications";
import { ApplicationsGrid } from "@/components/applications-grid";
import { PageHeader } from "@/components/page-header";

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
  const sort = params.sort ?? "applied_newest";
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
    <div className="space-y-6 pb-16">
      <PageHeader
        title="Applications"
        subtitle="Every application you've sent. See the status, the date, and what happened."
      />

      <ApplicationsGrid
        applications={result.applications}
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
