import { Skeleton } from "@/components/ui/skeleton";

export default function InsightsLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="-mx-6 border-b border-border pb-6">
        <div className="px-6">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="mt-1.5 h-4 w-56" />
        </div>
      </div>

      <Skeleton className="h-4 w-20" />

      {/* Summary stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-4xl border border-border bg-card p-5">
            <div className="flex items-center gap-4">
              <Skeleton className="size-11 shrink-0 rounded-4xl" />
              <div className="space-y-1.5">
                <Skeleton className="h-7 w-10" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Row 1: Pipeline + Application Status */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-4xl border border-border bg-card p-6 lg:col-span-2">
          <div className="mb-6 flex items-center justify-between">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-3 w-16" />
          </div>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-12" />
                </div>
                <Skeleton className="h-2 w-full" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-4xl border border-border bg-card p-6">
          <div className="mb-6 flex items-center justify-between">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-3 w-12" />
          </div>
          <div className="space-y-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-12" />
                </div>
                <Skeleton className="h-2 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Match Quality - full width */}
      <div className="rounded-4xl border border-border bg-card p-6">
        <Skeleton className="mb-6 h-5 w-32" />
        <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-start">
          <Skeleton className="size-36 shrink-0 rounded-full" />
          <div className="grid grid-cols-3 gap-6 sm:flex-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="text-center">
                <div className="flex items-center justify-center gap-1.5">
                  <Skeleton className="size-2.5 rounded-full" />
                  <Skeleton className="h-8 w-8" />
                </div>
                <Skeleton className="mx-auto mt-1 h-3 w-14" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 2: Sources + Work Location + Practice */}
      <div className="grid gap-6 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-4xl border border-border bg-card p-6">
            <div className="mb-4 flex items-center gap-2">
              <Skeleton className="size-4" />
              <Skeleton className="h-5 w-24" />
            </div>
            <Skeleton className="h-48 w-full" />
          </div>
        ))}
      </div>

      {/* Employment Types */}
      <div className="rounded-4xl border border-border bg-card p-6">
        <Skeleton className="mb-4 h-5 w-32" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
