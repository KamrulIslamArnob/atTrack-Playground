"use client";

import { useState } from "react";
import {
  Briefcase,
  Building2,
  House,
  Blend,
  CircleHelp,
  Clock3,
  CalendarClock,
  Handshake,
  GraduationCap,
  HeartHandshake,
  FileText,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";

const tooltipStyle = {
  borderRadius: "12px",
  border: "1px solid var(--border)",
  background: "var(--popover)",
  color: "var(--popover-foreground)",
  boxShadow: "var(--elevation-3)",
  fontSize: "12px",
};

/** Recharts axis/grid ink — same job as text-muted-foreground and border, just
    read as CSS var strings since these props take plain color values, not classes. */
const axisTick = { fontSize: 11, fill: "var(--muted-foreground)" };
const gridStroke = "var(--border)";

interface TrendData {
  date: string;
  applications: number;
  interviews: number;
}

interface McqScoreData {
  date: string;
  score: number;
}

export interface PipelineStage {
  id: string;
  name: string;
  count: number;
  /** Read from board_lists.color so a renamed/recoloured list stays in sync. */
  color: string;
}

/**
 * The pipeline reads board lists, not jobs.status — that column is written by a
 * trigger that only ever stores 'saved' or 'preparing', so it cannot represent
 * a job that has been applied to. Stage order and membership follow the board,
 * which is why a custom list shows up here the moment a user creates one.
 */
export function PipelineStages({ stages, total }: { stages: PipelineStage[]; total: number }) {
  const [active, setActive] = useState<string | null>(null);

  return (
    <div className="w-full">
      {/* High-contrast compact pipeline flow */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 scrollbar-none sm:gap-2">
        {stages.map((stage, i) => {
          const isLast = i === stages.length - 1;
          const share = total > 0 ? Math.round((stage.count / total) * 100) : 0;
          const isDim = stage.count === 0;
          const isActive = active === stage.id;

          return (
            <div key={stage.id} className="flex min-w-[115px] flex-1 shrink-0 items-center gap-1.5 sm:gap-2">
              {/* Stage Node Card */}
              <div
                onMouseEnter={() => setActive(stage.id)}
                onMouseLeave={() => setActive(null)}
                className={`group relative flex-1 overflow-hidden rounded-xl border p-2.5 sm:p-3 transition-all duration-200 cursor-default ${
                  isActive
                    ? "border-border shadow-md -translate-y-0.5 bg-card"
                    : isDim
                      ? "border-border/50 bg-muted/20 opacity-50 hover:opacity-100 hover:bg-card hover:border-border"
                      : "border-border/80 bg-card shadow-2xs hover:-translate-y-0.5 hover:shadow-sm"
                }`}
                style={{
                  backgroundColor: !isDim
                    ? `color-mix(in oklch, ${stage.color}, var(--card) 96%)`
                    : undefined,
                  borderColor: isActive ? stage.color : undefined,
                  animationDelay: `${i * 35}ms`,
                }}
              >
                {/* Top Colored Stage Accent Bar */}
                <div
                  className="absolute inset-x-0 top-0 h-[3px] transition-all duration-200 group-hover:h-[4px]"
                  style={{
                    backgroundColor: stage.color,
                    opacity: isDim ? 0.35 : 1,
                  }}
                />

                {/* Stage Header */}
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="size-2 shrink-0 rounded-full ring-2 ring-background transition-transform duration-200 group-hover:scale-125"
                      style={{ backgroundColor: stage.color }}
                    />
                    <span className="truncate text-xs font-semibold text-foreground/90 group-hover:text-foreground">
                      {stage.name}
                    </span>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-1.5 py-0.2 text-[10px] font-medium tabular-nums border"
                    style={{
                      backgroundColor: `color-mix(in oklch, ${stage.color}, transparent 92%)`,
                      borderColor: `color-mix(in oklch, ${stage.color}, transparent 80%)`,
                      color: isDim ? "var(--muted-foreground)" : "var(--foreground)",
                    }}
                  >
                    {share}%
                  </span>
                </div>

                {/* Stage Metrics */}
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-xl font-extrabold tabular-nums tracking-tight text-foreground sm:text-2xl leading-none">
                    {stage.count}
                  </span>
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    {stage.count === 1 ? "job" : "jobs"}
                  </span>
                </div>
              </div>

              {/* High-Contrast Directional Arrow */}
              {!isLast && (
                <div
                  className={`flex shrink-0 items-center justify-center transition-colors ${
                    !isDim ? "text-foreground/40" : "text-muted-foreground/20"
                  }`}
                  aria-hidden="true"
                >
                  <ChevronRight className="size-4 stroke-[2.5]" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export interface BreakdownItem {
  label: string;
  count: number;
}

/**
 * Icons live here rather than on the item because a component function cannot
 * cross the RSC boundary — the server page sends labels and counts only.
 * Work-location and employment-type labels don't collide, so one map serves both.
 */
const breakdownIcons: Record<string, LucideIcon> = {
  Remote: House,
  Hybrid: Blend,
  "On-site": Building2,
  Unspecified: CircleHelp,
  "Full-time": Briefcase,
  "Part-time": Clock3,
  Contract: FileText,
  Freelance: Handshake,
  Internship: GraduationCap,
  Temporary: CalendarClock,
  Apprenticeship: GraduationCap,
  Volunteer: HeartHandshake,
};

/**
 * A category split in one bar plus a legend, sized for a half-width card.
 * Hovering either half highlights the other so the colour mapping never has to
 * be memorised.
 */
export function BreakdownBar({ items, total }: { items: BreakdownItem[]; total: number }) {
  const [active, setActive] = useState<string | null>(null);

  if (total === 0) {
    return <p className="py-4 text-xs text-muted-foreground">No jobs yet</p>;
  }

  return (
    <div>
      <div className="flex h-2.5 w-full gap-1 overflow-hidden rounded-full bg-muted">
        {items.map((item, i) => (
          <div
            key={item.label}
            role="presentation"
            title={`${item.label}: ${item.count}`}
            onMouseEnter={() => setActive(item.label)}
            onMouseLeave={() => setActive(null)}
            className="stat-bar-grow h-full rounded-full transition-opacity duration-200"
            style={{
              width: `${(item.count / total) * 100}%`,
              backgroundColor: `var(--chart-${(i % 5) + 1})`,
              animationDelay: `${i * 60}ms`,
              opacity: active && active !== item.label ? 0.3 : 1,
            }}
          />
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {items.map((item, i) => {
          const Icon = breakdownIcons[item.label] ?? CircleHelp;
          return (
            <div
              key={item.label}
              onMouseEnter={() => setActive(item.label)}
              onMouseLeave={() => setActive(null)}
              className="agent-fade-up flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition-colors border-border"
              style={{ animationDelay: `${i * 45}ms` }}
            >
              <Icon
                className="size-3 shrink-0"
                style={{ color: `var(--chart-${(i % 5) + 1})` }}
                aria-hidden="true"
              />
              <span className="text-[11px] text-muted-foreground">{item.label}</span>
              <span className="text-[11px] font-semibold tabular-nums">{item.count}</span>
              <span className="text-[10px] text-muted-foreground">
                {Math.round((item.count / total) * 100)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export interface MatchScoreBand {
  /** "Strong" | "Fair" | "Weak" — same thresholds as matchScoreBand() in lib/types/board.ts. */
  label: string;
  count: number;
}

/**
 * Score bands are a status signal (good/fair/weak fit), not a category, so
 * they get the reserved status tokens — same mapping job-detail's overview
 * tab uses for its ring (components/job-detail/tabs/overview-tab.tsx
 * scoreTone()), not a chart-* categorical color.
 */
const scoreBandColor: Record<string, string> = {
  Strong: "var(--success)",
  Fair: "var(--warning)",
  Weak: "var(--destructive)",
};

export function MatchScoreDistributionChart({ data }: { data: MatchScoreBand[] }) {
  const filtered = data.filter((d) => d.count > 0);
  const total = filtered.reduce((sum, d) => sum + d.count, 0);

  if (total === 0) {
    return <p className="py-4 text-center text-xs text-muted-foreground">No scored jobs yet</p>;
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={160}>
        <PieChart>
          <Pie
            data={filtered}
            cx="50%"
            cy="50%"
            innerRadius={48}
            outerRadius={70}
            paddingAngle={3}
            dataKey="count"
            nameKey="label"
          >
            {filtered.map((entry) => (
              <Cell key={entry.label} fill={scoreBandColor[entry.label]} stroke="var(--card)" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-2 flex items-center justify-center gap-4 text-xs">
        {filtered.map((entry) => (
          <div key={entry.label} className="flex items-center gap-1.5">
            <div className="size-2 rounded-full" style={{ backgroundColor: scoreBandColor[entry.label] }} />
            <span className="text-muted-foreground">{entry.label}</span>
            <span className="font-medium tabular-nums">{entry.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ApplicationTrendChart({ data }: { data: TrendData[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data} margin={{ top: 5, right: 5, left: -5, bottom: 0 }}>
        <defs>
          <linearGradient id="colorApplications" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorInterviews" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
        <XAxis dataKey="date" tick={axisTick} axisLine={false} tickLine={false} />
        <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Area type="monotone" dataKey="applications" stroke="var(--chart-1)" fillOpacity={1} fill="url(#colorApplications)" strokeWidth={2} />
        <Area type="monotone" dataKey="interviews" stroke="var(--chart-2)" fillOpacity={1} fill="url(#colorInterviews)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function McqScoreChart({ data }: { data: McqScoreData[] }) {
  return (
    <ResponsiveContainer width="100%" height={100}>
      <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Line type="monotone" dataKey="score" stroke="var(--primary)" strokeWidth={2} dot={{ fill: "var(--primary)", strokeWidth: 0, r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
