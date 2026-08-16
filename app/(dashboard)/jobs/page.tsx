import { getJobsList } from "@/lib/actions/jobs-list";
import { getBoard } from "@/lib/actions/board";
import { UnifiedJobsView } from "@/components/jobs/unified-jobs-view";

interface PageProps {
  searchParams: Promise<{
    search?: string;
    status?: string;
    sort?: string;
    page?: string;
    perPage?: string;
    view?: string;
  }>;
}

export const metadata = { title: "Jobs" };

export default async function JobsPage(props: PageProps) {
  const params = await props.searchParams;

  const search = params.search ?? "";
  const status = params.status ?? "all";
  const sort = params.sort ?? "newest";
  const page = Number(params.page) || 1;
  const perPage = Number(params.perPage) || 30;
  const initialView = params.view === "list" ? "list" : "board";

  const [{ lists, cards }, jobsListResult] = await Promise.all([
    getBoard(),
    getJobsList({
      search,
      status,
      sort,
      page,
      perPage,
    }),
  ]);

  return (
    <UnifiedJobsView
      initialView={initialView}
      boardLists={lists}
      boardCards={cards}
      jobsListResult={jobsListResult}
      initialSearch={search}
      initialStatus={status}
    />
  );
}
