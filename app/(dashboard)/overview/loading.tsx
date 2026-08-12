import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumbs } from "@/components/breadcrumbs";

export default function OverviewLoading() {
  return (
    <div className="space-y-6">
      {/* Hero banner */}
      <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24 rounded-2xl" />
            <Skeleton className="h-9 w-24 rounded-2xl" />
          </div>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-10 shrink-0 rounded-2xl" />
              <div className="space-y-1.5">
                <Skeleton className="h-5 w-10" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <Breadcrumbs />

      {/* Pipeline */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="space-y-1">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-40 w-full" />
        <div className="mt-3 flex flex-wrap gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <Skeleton className="size-2 rounded-full" />
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-3 w-4" />
            </div>
          ))}
        </div>
      </div>

      {/* Trend + Timing */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 rounded-2xl border border-border bg-card p-6 lg:col-span-2">
          <div className="mb-4 space-y-1">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-44 w-full" />
          <div className="mt-3 flex items-center justify-center gap-5">
            <div className="flex items-center gap-1.5">
              <Skeleton className="size-2 rounded-full" />
              <Skeleton className="h-3 w-16" />
            </div>
            <div className="flex items-center gap-1.5">
              <Skeleton className="size-2 rounded-full" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        </div>
        <div className="min-w-0 rounded-2xl border border-border bg-card p-6">
          <div className="mb-4 space-y-1">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-3 w-28" />
          </div>
          <div className="space-y-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-10 shrink-0 rounded-xl" />
                <div className="space-y-1.5">
                  <Skeleton className="h-6 w-12" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Breakdowns row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-5">
            <Skeleton className="mb-3 h-4 w-20" />
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Skeleton className="size-2 rounded-full" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <Skeleton className="h-3 w-4" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Interviews row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="min-w-0 rounded-2xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="space-y-1">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-3 w-16" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-border p-3">
                <Skeleton className="size-9 shrink-0 rounded-xl" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <div className="space-y-1">
                  <Skeleton className="h-5 w-12 rounded-full" />
                  <Skeleton className="h-3 w-10" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="min-w-0 rounded-2xl border border-border bg-card p-6">
          <div className="mb-4 space-y-1">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-8 rounded-xl" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-5 w-8" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
