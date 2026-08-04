import { Skeleton } from "@/components/ui/skeleton";

export default function AdminAiUsageLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="-mx-6 border-b border-border pb-6">
        <div className="flex items-center justify-between px-6">
          <div className="space-y-2">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-4 w-80" />
          </div>
          <Skeleton className="h-8 w-24" />
        </div>
      </div>

      {/* Breadcrumbs */}
      <Skeleton className="h-4 w-48" />

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-4xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 shrink-0 rounded-4xl" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Search + filters row */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <Skeleton className="h-10 w-full lg:w-72" />
        <Skeleton className="h-10 w-[130px]" />
        <div className="flex items-center gap-1 lg:ml-auto">
          <Skeleton className="h-10 w-[70px]" />
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-10 w-10" />
        </div>
      </div>

      {/* Results count */}
      <Skeleton className="h-3 w-36" />

      {/* Table */}
      <div className="rounded-4xl border border-border">
        <div className="bg-muted/50 px-4 py-3">
          <div className="flex gap-4">
            <Skeleton className="h-4 w-10" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="px-4 py-3">
              <div className="flex items-center gap-4">
                <Skeleton className="h-3 w-8" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-3 flex-1" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
