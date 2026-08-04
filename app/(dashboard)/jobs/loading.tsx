import { Skeleton } from "@/components/ui/skeleton";

export default function JobsLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="-mx-6 border-b border-border pb-6">
        <div className="flex items-center justify-between px-6">
          <div className="space-y-1.5">
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-9 w-24 rounded-4xl" />
        </div>
      </div>

      <Skeleton className="h-4 w-20" />

      {/* Search + filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <Skeleton className="h-10 w-full lg:w-72" />
        <Skeleton className="h-10 w-full lg:w-[130px]" />
        <Skeleton className="h-10 w-full lg:w-[160px]" />
        <div className="flex items-center gap-1 lg:ml-auto">
          <Skeleton className="h-9 w-20 rounded-4xl" />
          <Skeleton className="h-9 w-9 rounded-4xl" />
        </div>
      </div>

      {/* Job cards grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-4xl border border-border bg-card p-5">
            <div className="mb-3 flex items-start justify-between">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <div className="mb-4 space-y-2">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
