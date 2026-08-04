export function SectionSeparator() {
  return (
    <div className="px-6">
      <div className="relative mx-auto max-w-6xl">
        <div className="h-px w-full bg-linear-to-r from-transparent via-primary/30 to-transparent" />
        <div className="absolute top-1/2 left-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/40 shadow-[0_0_12px_2px] shadow-primary/30" />
      </div>
    </div>
  );
}
