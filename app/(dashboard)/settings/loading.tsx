import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="-mx-6 border-b border-border pb-6">
        <div className="px-6">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="mt-1.5 h-4 w-48" />
        </div>
      </div>

      <Skeleton className="h-4 w-20" />

      {/* Avatar card */}
      <div className="rounded-4xl border border-border bg-card p-6">
        <div className="flex items-center gap-6">
          <Skeleton className="size-24 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-3 w-36" />
          </div>
        </div>
      </div>

      {/* Personal Info card */}
      <div className="rounded-4xl border border-border bg-card p-6">
        <Skeleton className="mb-4 h-5 w-40" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      </div>

      {/* SMTP card */}
      <div className="rounded-4xl border border-border bg-card p-6">
        <Skeleton className="mb-4 h-5 w-32" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      </div>

      {/* Account card */}
      <div className="rounded-4xl border border-border bg-card p-6">
        <Skeleton className="mb-4 h-5 w-20" />
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-4 w-40" />
          </div>
          <Skeleton className="h-10 w-24 rounded-4xl" />
        </div>
      </div>

      {/* Danger Zone card */}
      <div className="rounded-4xl border border-destructive/20 bg-card p-6">
        <Skeleton className="mb-4 h-5 w-28" />
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-10 w-32 rounded-4xl" />
        </div>
      </div>
    </div>
  );
}
