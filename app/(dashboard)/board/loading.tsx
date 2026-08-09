import { Skeleton } from "@/components/ui/skeleton";

export default function BoardLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="-mx-6 border-b border-border pb-6">
        <div className="flex items-center justify-between px-6">
          <div className="space-y-1.5">
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
      </div>

      <Skeleton className="h-4 w-20" />

      {/* Columns */}
      <div className="-mx-6 overflow-hidden px-6 pb-4">
        <div className="flex gap-3">
          {Array.from({ length: 5 }).map((_, col) => (
            <div key={col} className="flex w-72 shrink-0 flex-col p-1">
              <div className="flex items-center gap-2 px-3 pb-2 pt-2">
                <Skeleton className="size-6 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-2.5 w-12" />
                </div>
              </div>
              <Skeleton className="mx-1 mb-2 h-9 rounded-2xl" />
              <div className="flex flex-col gap-2 px-1">
                {Array.from({ length: col === 0 ? 3 : 2 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border border-l-4 border-border bg-card p-4"
                  >
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="mt-2.5 h-3 w-24" />
                    <div className="mt-3 flex items-center justify-between">
                      <Skeleton className="h-2.5 w-16" />
                      <Skeleton className="h-4 w-14 rounded-2xl" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
