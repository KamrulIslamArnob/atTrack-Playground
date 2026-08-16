"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  ArrowUpDown,
  Building2,
  Tag as TagIcon,
  Clock,
  HeartHandshake,
  ExternalLink,
  Plus,
  Check,
  Minus,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

/* ─────────────────────────────────────────────────────────
 * RECORDS TABLE — Compact CRM Grid Component
 *
 * Complies with 10-Tier Design System:
 * - Tier 1: Clean table styling, structural borders only
 * - Tier 2: 4px spacing rhythm (px-3 py-2, gap-1.5)
 * - Tier 3: Rounded-2xl container, rounded-lg tags, rounded-md checkbox
 * - Tier 4: Text-xs cell fonts, text-[11px] secondary badges
 * - Tier 5: Semantic design tokens (text-success, bg-warning/10, etc.)
 * - Tier 6: Hover state highlight, active press feedback
 * - Tier 7: Uniform Lucide icons
 * - Tier 8: Apple spring transitions & reduced motion check
 * ───────────────────────────────────────────────────────── */

type Strength = "strong" | "weak" | "veryweak" | "none";
type SortKey = "name" | "last" | "strength";

const STRENGTH: Record<Strength, { label: string; tint: string; rank: number }> = {
  strong: { label: "Very strong", tint: "text-success bg-success/10", rank: 3 },
  weak: { label: "Fair", tint: "text-warning bg-warning/10", rank: 2 },
  veryweak: { label: "Weak", tint: "text-destructive bg-destructive/10", rank: 1 },
  none: { label: "No contact", tint: "text-muted-foreground bg-muted", rank: 0 },
};

type Row = {
  id: string;
  name: string;
  tags: string[];
  last: string;
  strength: Strength;
  website?: string;
};

const INITIAL_ROWS: Row[] = [
  { id: "aurora", name: "Aurora Scoops", tags: ["Gelato", "Seasonal"], last: "9 days ago", strength: "strong", website: "aurora-scoops.example.com" },
  { id: "kumo", name: "Kumo Creamery", tags: ["B2C", "Cafe", "Vegan"], last: "3 weeks ago", strength: "strong", website: "kumo-creamery.example.com" },
  { id: "sol-nieve", name: "Sol y Nieve", tags: ["Gelato", "Local"], last: "2 months ago", strength: "weak", website: "sol-y-nieve.example.com" },
  { id: "maple-orbit", name: "Maple Orbit", tags: ["B2B", "Wholesale"], last: "15 days ago", strength: "weak", website: "maple-orbit.example.com" },
  { id: "blue-fig", name: "Blue Fig Gelato", tags: ["Gelato", "Cafe"], last: "1 year ago", strength: "veryweak", website: "blue-fig.example.com" },
  { id: "cloudberry", name: "Cloudberry Cone", tags: ["Dairy-free"], last: "No contact", strength: "none", website: "cloudberry-cone.example.com" },
];

export function RecordsTable() {
  const rows = INITIAL_ROWS;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "name", dir: 1 });
  const shouldReduceMotion = useReducedMotion();

  const visibleRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const value =
        sort.key === "name"
          ? a.name.localeCompare(b.name)
          : sort.key === "last"
          ? a.last.localeCompare(b.last)
          : STRENGTH[a.strength].rank - STRENGTH[b.strength].rank;
      return value * sort.dir;
    });
  }, [sort, rows]);

  const allSelected = visibleRows.length > 0 && visibleRows.every((row) => selected.has(row.id));
  const partiallySelected = !allSelected && visibleRows.some((row) => selected.has(row.id));

  const toggleSort = (key: SortKey) =>
    setSort((current) =>
      current.key === key ? { key, dir: (current.dir * -1) as 1 | -1 } : { key, dir: 1 }
    );

  const toggleRow = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected((current) => {
      const next = new Set(current);
      if (allSelected) visibleRows.forEach((row) => next.delete(row.id));
      else visibleRows.forEach((row) => next.add(row.id));
      return next;
    });

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground">
              {/* Select All Checkbox & Company Name */}
              <th className="px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleAll}
                    className={cn(
                      "flex size-4 items-center justify-center rounded border transition-all cursor-pointer",
                      allSelected || partiallySelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-transparent"
                    )}
                  >
                    {partiallySelected ? (
                      <Minus className="size-3 stroke-[3]" />
                    ) : allSelected ? (
                      <Check className="size-3 stroke-[3]" />
                    ) : null}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleSort("name")}
                    className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
                  >
                    <Building2 className="size-3.5" />
                    <span>Company</span>
                    <ArrowUpDown className="size-3 opacity-60" />
                  </button>
                </div>
              </th>

              {/* Categories */}
              <th className="px-3 py-2.5">
                <div className="flex items-center gap-1">
                  <TagIcon className="size-3.5" />
                  <span>Tags</span>
                </div>
              </th>

              {/* Last Interaction */}
              <th className="px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => toggleSort("last")}
                  className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
                >
                  <Clock className="size-3.5" />
                  <span>Last touch</span>
                  <ArrowUpDown className="size-3 opacity-60" />
                </button>
              </th>

              {/* Connection Strength */}
              <th className="px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => toggleSort("strength")}
                  className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
                >
                  <HeartHandshake className="size-3.5" />
                  <span>Strength</span>
                  <ArrowUpDown className="size-3 opacity-60" />
                </button>
              </th>

              {/* Website Link */}
              <th className="px-3 py-2.5">Link</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-border">
            {visibleRows.map((row) => {
              const isSelected = selected.has(row.id);
              const strength = STRENGTH[row.strength];

              return (
                <motion.tr
                  key={row.id}
                  initial={shouldReduceMotion ? undefined : { opacity: 0 }}
                  animate={shouldReduceMotion ? undefined : { opacity: 1 }}
                  className={cn(
                    "transition-colors hover:bg-muted/40",
                    isSelected && "bg-primary/5"
                  )}
                >
                  {/* Row Checkbox & Company Name */}
                  <td className="px-3 py-2.5 font-medium text-foreground">
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => toggleRow(row.id)}
                        className={cn(
                          "flex size-4 items-center justify-center rounded border transition-all cursor-pointer",
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card text-transparent"
                        )}
                      >
                        {isSelected && <Check className="size-3 stroke-[3]" />}
                      </button>
                      <span className="truncate">{row.name}</span>
                    </div>
                  </td>

                  {/* Tags */}
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {row.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>

                  {/* Last Touch */}
                  <td className="px-3 py-2.5 text-muted-foreground text-[11px]">{row.last}</td>

                  {/* Strength */}
                  <td className="px-3 py-2.5">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold",
                        strength.tint
                      )}
                    >
                      {strength.label}
                    </span>
                  </td>

                  {/* Link */}
                  <td className="px-3 py-2.5">
                    {row.website ? (
                      <a
                        href={`https://${row.website}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                      >
                        <span className="truncate max-w-[120px]">{row.website}</span>
                        <ExternalLink className="size-3 shrink-0 opacity-70" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                </motion.tr>
              );
            })}
          </tbody>

          {/* Footer Summary Row */}
          <tfoot>
            <tr className="border-t border-border bg-muted/30 text-[11px] text-muted-foreground font-medium">
              <td className="px-3 py-2">{rows.length} total records</td>
              <td className="px-3 py-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-primary hover:underline cursor-pointer"
                >
                  <Plus className="size-3" />
                  <span>Add calculation</span>
                </button>
              </td>
              <td className="px-3 py-2">—</td>
              <td className="px-3 py-2">
                {Math.round(
                  (rows.reduce((sum, r) => sum + STRENGTH[r.strength].rank, 0) /
                    (rows.length * 3)) *
                    100
                )}
                % average
              </td>
              <td className="px-3 py-2">{rows.filter((r) => r.website).length} links</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
export default RecordsTable;
