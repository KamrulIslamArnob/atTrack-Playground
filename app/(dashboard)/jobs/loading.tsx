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
          <Skeleton className="h-9 w-24 rounded-2xl" />
        </div>
      </div>

      <Skeleton className="h-4 w-20" />

      {/* Search + filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <Skeleton className="h-10 w-full lg:w-72" />
        <Skeleton className="h-10 w-full lg:w-[130px]" />
        <div className="flex items-center gap-1 lg:ml-auto">
          <Skeleton className="h-9 w-20 rounded-2xl" />
          <Skeleton className="h-9 w-9 rounded-2xl" />
        </div>
      </div>

      {/* Job table */}
      <div className="overflow-hidden rounded-2xl border border-border">
        <div className="h-10 bg-muted/60" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-t border-border/60 px-3 py-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="ml-auto h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
