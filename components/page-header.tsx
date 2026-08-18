interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: string;
  /** Right-aligned actions rendered in Layer 1 beside title/subtitle. */
  actions?: React.ReactNode;
  /** Toolbar items rendered in Layer 2 below the header line. */
  children?: React.ReactNode;
  /** Optional element rendered beside the title (e.g. InfoTooltip) */
  titleExtra?: React.ReactNode;
  /** Optional breadcrumb label overrides (legacy). */
  breadcrumbLabels?: Record<string, string>;
  /** Hide the toolbar row (Layer 2) when the page handles it elsewhere. */
  hideBreadcrumbRow?: boolean;
}

/**
 * Consistent page header used across all dashboard pages.
 *
 * Layer 1 — full-width title + subtitle + actions, bordered bottom (h-[68px]).
 * Layer 2 — toolbar children (right), bordered bottom (only rendered when children present).
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  children,
  titleExtra,
  hideBreadcrumbRow,
}: PageHeaderProps) {
  return (
    <div className="space-y-0">
      {/* Layer 1 — Title + Subtitle */}
      <div className="-mx-6 border-b border-border h-[68px] flex items-center px-6 shrink-0 overflow-hidden">
        <div className="flex items-center justify-between gap-3 w-full py-2 min-w-0">
          <div className="flex items-center gap-3 min-w-0 flex-nowrap">
            {typeof title === "string" ? (
              <h1 className="font-heading text-xl sm:text-2xl font-semibold tracking-tight whitespace-nowrap shrink-0">
                {title}
              </h1>
            ) : (
              title
            )}
            {titleExtra}
            {subtitle && (
              <p className="text-xs sm:text-sm text-muted-foreground truncate hidden xl:inline max-w-xl">
                {subtitle}
              </p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      </div>

      {/* Layer 2 — Toolbar Actions (no bottom line) */}
      {!hideBreadcrumbRow && children && (
        <div className="-mx-6 flex flex-wrap items-center justify-between gap-3 px-6 py-2.5">
          {children}
        </div>
      )}
    </div>
  );
}
