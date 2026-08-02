import { getInterviews } from "@/lib/actions/interviews";
import { InterviewsTable } from "@/components/interviews-table";
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

export default async function InterviewsPage(props: PageProps) {
  const params = await props.searchParams;

  const search = params.search ?? "";
  const status = params.status ?? "all";
  const sort = params.sort ?? "newest";
  const page = Number(params.page) || 1;
  const perPage = Number(params.perPage) || 30;

  const result = await getInterviews({
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
            <h1 className="text-2xl font-semibold tracking-tight">Interviews</h1>
            <p className="text-sm text-muted-foreground">
              Track and manage your upcoming and past interviews.
            </p>
          </div>
        </div>
      </div>

      <Breadcrumbs />

      <InterviewsTable
        interviews={result.interviews}
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
