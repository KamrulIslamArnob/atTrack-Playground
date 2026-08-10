import { redirect } from "next/navigation";
import { getJobDetail } from "@/lib/actions/job-detail";
import { JobDetailRefresh } from "@/components/job-detail/job-detail-refresh";

export default async function JobDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const data = await getJobDetail(id);

  if (!data) {
    redirect("/jobs");
  }

  return (
    <div className="-mx-6 -my-8 min-h-[calc(100vh-4rem)] bg-card">
      <JobDetailRefresh data={data} />
    </div>
  );
}
    </div>
  );
}
