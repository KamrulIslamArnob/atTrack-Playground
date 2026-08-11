import { getJobsList } from "@/lib/actions/jobs-list";
import { JobsGrid } from "@/components/jobs-grid";
import { PageHeader } from "@/components/page-header";
import { JobsToolbar } from "@/components/jobs-toolbar";

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
    <div className="space-y-4">
      <PageHeader
        title="Jobs"
        subtitle="Every job you've saved, in one list. Search, filter, and open any of them."
      >
        <JobsToolbar
          initialSearch={search}
          initialStatus={status}
          page={result.page}
          totalPages={result.totalPages}
          perPage={result.perPage}
        />
      </PageHeader>

      <JobsGrid
        jobs={result.jobs}
        total={result.total}
        initialSearch={search}
        initialStatus={status}
        page={result.page}
        totalPages={result.totalPages}
        perPage={result.perPage}
      />
    </div>
  );
}
