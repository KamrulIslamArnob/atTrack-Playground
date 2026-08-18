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
    <div className="min-h-full bg-card">
      <JobDetailRefresh data={data} />
    </div>
  );
}
