import { Breadcrumbs } from "@/components/breadcrumbs";

interface PageHeaderProps {
  title: string;
  subtitle: string;
  /** Toolbar items rendered to the right of the breadcrumbs in Layer 2. */
  children?: React.ReactNode;
  /** Optional breadcrumb label overrides. */
  breadcrumbLabels?: Record<string, string>;
}

/**
 * Consistent 2-layer page header used across all dashboard pages.
 *
 * Layer 1 — full-width title + subtitle, bordered bottom.
 * Layer 2 — breadcrumbs (left) + toolbar children (right), bordered bottom.
 */
export function PageHeader({
  title,
  subtitle,
  children,
  breadcrumbLabels,
}: PageHeaderProps) {
  return (
    <div className="space-y-0">
      {/* Layer 1 — Title + Subtitle */}
      <div className="-mx-6 border-b border-border pb-4">
        <div className="px-6">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {title}
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            {subtitle}
          </p>
        </div>
      </div>

      {/* Layer 2 — Breadcrumbs + Toolbar */}
      <div className="-mx-6 flex flex-wrap items-center gap-3 border-b border-border px-6 py-3">
        <Breadcrumbs labels={breadcrumbLabels} />
        <div className="flex-1" />
        {children}
      </div>
    </div>
  );
}
