import { getInterviews, getPreparingJobs } from "@/lib/actions/interviews";
import { InterviewsTable } from "@/components/interviews-table";
import { AddInterviewDialog } from "@/components/add-interview-dialog";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { Plus } from "lucide-react";

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

  const preparingJobs = await getPreparingJobs();

  return (
    <div className="space-y-6 pb-16">
      <PageHeader
        title="Interviews"
        subtitle="Every interview you've had or have coming up. Add notes, prep, and see how you did."
      >
        <AddInterviewDialog
          jobs={preparingJobs}
          trigger={
            <button
              className={buttonVariants({ size: "sm", className: "gap-1.5" })}
            >
              <Plus className="size-4" />
              Add interview
            </button>
          }
        />
      </PageHeader>

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
