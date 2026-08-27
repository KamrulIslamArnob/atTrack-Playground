"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { JobDetailContent } from "@/components/job-detail/job-detail-content";
import { getJobDetail } from "@/lib/actions/job-detail";
import type { JobDetailData } from "@/lib/types/job-detail";

/**
 * Thin client wrapper so /jobs/[id]/page.tsx (a server component) can still
 * hand JobDetailContent a working onRefresh — re-fetches getJobDetail() after
 * a mutation instead of a full page reload, same as the board's Sheet.
 */
export function JobDetailRefresh({ data: initialData }: { data: JobDetailData }) {
  const router = useRouter();
  const [data, setData] = useState(initialData);

  const handleRefresh = useCallback(async () => {
    const fresh = await getJobDetail(initialData.job.id);
    if (fresh) {
      setData(fresh);
      router.refresh();
    } else {
      router.push("/board");
    }
  }, [initialData.job.id, router]);

  const handleDelete = useCallback(() => {
    router.push("/board");
  }, [router]);

  return <JobDetailContent data={data} onRefresh={handleRefresh} onDelete={handleDelete} />;
}
