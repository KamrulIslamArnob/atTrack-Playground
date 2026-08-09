interface LegalShellProps {
  badge: string;
  title: string;
  subtitle: string;
  updated: string;
  children: React.ReactNode;
}

export function LegalShell({
  badge,
  title,
  subtitle,
  updated,
  children,
}: LegalShellProps) {
  return (
    <>
      <header className="relative overflow-hidden bg-background px-6 pt-32 pb-20 sm:pt-40">
        <div className="absolute inset-0 -top-18 bg-linear-to-b from-primary/3 via-background to-background" />
        <div className="absolute inset-0 bg-[radial-gradient(circle,var(--border)_1px,transparent_1px)] bg-size-[32px_32px] opacity-40" />
        <div className="absolute -left-32 -top-32 size-96 rounded-full bg-primary/[0.07] blur-3xl" />
        <div className="absolute -bottom-32 -right-32 size-96 rounded-full bg-primary/5 blur-3xl" />

        <div className="relative mx-auto max-w-3xl">
          <div className="mt-16 text-center">
            <span className="inline-flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
              {badge}
            </span>
            <h1 className="mt-5 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              {title}
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground sm:text-base">
              {subtitle}
            </p>
            <p className="mt-5 text-xs text-muted-foreground/70">
              Last updated: {updated}
            </p>
          </div>
        </div>
      </header>

      <main className="px-6 pb-28">
        <div className="mx-auto max-w-3xl">{children}</div>
      </main>
    </>
  );
}

interface LegalSectionProps {
  index: string;
  title: string;
  children: React.ReactNode;
}

export function LegalSection({ index, title, children }: LegalSectionProps) {
  return (
    <section className="mt-10 border-t border-border/60 pt-10 first:mt-0 first:border-t-0 first:pt-0">
      <h2 className="flex items-center gap-3 font-display text-xl font-semibold tracking-tight sm:text-2xl">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 font-heading text-xs font-semibold text-primary">
          {index}
        </span>
        {title}
      </h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export function LegalParagraph({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <p className="text-sm leading-relaxed text-muted-foreground [&_strong]:font-semibold [&_strong]:text-foreground sm:text-[15px]">
      {children}
    </p>
  );
}

export function LegalList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item, i) => (
        <li
          key={i}
          className="flex gap-3 text-sm leading-relaxed text-muted-foreground [&_strong]:font-semibold [&_strong]:text-foreground sm:text-[15px]"
        >
          <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function LegalNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm leading-relaxed text-muted-foreground [&_strong]:font-semibold [&_strong]:text-foreground sm:text-[15px]">
      {children}
    </div>
  );
}
