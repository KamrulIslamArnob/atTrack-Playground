import { Skeleton } from "@/components/ui/skeleton";

export default function AdminUserDetailLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="-mx-6 border-b border-border pb-6">
        <div className="flex items-center gap-4 px-6">
          <Skeleton className="size-9 shrink-0 rounded-2xl" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
      </div>

      {/* Profile card */}
      <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-background p-6">
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
          <Skeleton className="size-16 shrink-0 rounded-full" />
          <div className="flex-1 space-y-3 text-center sm:text-left">
            <div className="flex items-center justify-center gap-2 sm:justify-start">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="h-5 w-12 rounded-full" />
            </div>
            <Skeleton className="mx-auto h-4 w-48 sm:mx-0" />
            <div className="flex flex-wrap justify-center gap-4 sm:justify-start">
              <Skeleton className="h-3 w-36" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2.5 rounded-2xl border border-border bg-muted/40 px-3 py-2.5">
              <Skeleton className="size-4 shrink-0" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-2.5 w-14" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="space-y-4">
        <div className="flex gap-2">
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-24" />
        </div>

        {/* Filter row */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <Skeleton className="h-10 w-full lg:w-72" />
          <Skeleton className="h-10 w-[130px]" />
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
        <div className="rounded-2xl border border-border">
          <div className="bg-muted/50 px-4 py-3">
            <div className="flex gap-4">
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
          <div className="divide-y divide-border">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="px-4 py-3">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-3 w-8" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-3 flex-1" />
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
