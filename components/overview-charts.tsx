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
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { FileTextIcon } from "@/components/ui/file-text";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
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

/** Recharts axis/grid ink — read as CSS var strings since recharts props take color values */
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
 * Pipeline stages connected stepper with proportion bar and interactive stage cards.
 */
export function PipelineStages({ stages, total }: { stages: PipelineStage[]; total: number }) {
  const [active, setActive] = useState<string | null>(null);
  const shouldReduceMotion = useReducedMotion();

  if (stages.length === 0) {
    return null;
  }

  return (
    <div className="w-full space-y-3">
      {/* Proportion bar showing visual flow across stages */}
      {total > 0 && (
        <div className="flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full bg-muted">
          {stages.map((stage) => {
            const share = (stage.count / total) * 100;
            if (stage.count === 0) return null;
            const isHovered = active === stage.id;
            const isDimmed = active !== null && !isHovered;

            return (
              <div
                key={stage.id}
                role="presentation"
                title={`${stage.name}: ${stage.count} (${Math.round(share)}%)`}
                onMouseEnter={() => setActive(stage.id)}
                onMouseLeave={() => setActive(null)}
                className="h-full rounded-full transition-opacity duration-200 cursor-pointer"
                style={{
                  width: `${share}%`,
                  backgroundColor: stage.color,
                  opacity: isDimmed ? 0.35 : 1,
                }}
              />
            );
          })}
        </div>
      )}

      {/* Stage Cards Grid */}
      <div className="flex items-stretch gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-none sm:gap-2.5">
        {stages.map((stage, i) => {
          const share = total > 0 ? Math.round((stage.count / total) * 100) : 0;
          const isDim = stage.count === 0;
          const isActive = active === stage.id;

          return (
            <motion.div
              key={stage.id}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                type: "spring",
                bounce: 0,
                duration: 0.3,
                delay: shouldReduceMotion ? 0 : i * 0.03,
              }}
              whileHover={shouldReduceMotion ? undefined : { y: -2 }}
              whileTap={{ scale: 0.98 }}
              onMouseEnter={() => setActive(stage.id)}
              onMouseLeave={() => setActive(null)}
              className={`flex min-w-[125px] flex-1 flex-col justify-between rounded-xl border p-2.5 sm:p-3 transition-colors cursor-pointer select-none ${
                isActive
                  ? "border-primary bg-muted/60"
                  : isDim
                    ? "border-border/60 bg-muted/20 opacity-60 hover:opacity-100 hover:border-border hover:bg-muted/40"
                    : "border-border bg-card hover:bg-muted/40 hover:border-border"
              }`}
            >
              {/* Header: Stage Dot + Stage Name + Share Pill */}
              <div className="flex items-center justify-between gap-1.5 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: stage.color }}
                  />
                  <span className="truncate text-xs font-medium text-foreground">
                    {stage.name}
                  </span>
                </div>
                <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                  {share}%
                </span>
              </div>

              {/* Metric: Count + Label */}
              <div className="mt-2 flex items-baseline justify-between gap-1">
                <span className="text-xl font-bold tracking-tight text-foreground tabular-nums sm:text-2xl leading-none">
                  {stage.count}
                </span>
                <span className="text-[11px] font-medium text-muted-foreground">
                  {stage.count === 1 ? "job" : "jobs"}
                </span>
              </div>
            </motion.div>
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
const breakdownIcons: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  Remote: House,
  Hybrid: Blend,
  "On-site": Building2,
  Unspecified: CircleHelp,
  "Full-time": Briefcase,
  "Part-time": Clock3,
  Contract: FileTextIcon,
  Freelance: Handshake,
  Internship: GraduationCap,
  Temporary: CalendarClock,
  Apprenticeship: GraduationCap,
  Volunteer: HeartHandshake,
};

/**
 * A category split in one bar plus a legend, sized for a half-width card.
 */
export function BreakdownBar({ items, total }: { items: BreakdownItem[]; total: number }) {
  const [active, setActive] = useState<string | null>(null);

  if (total === 0) {
    return <p className="py-4 text-xs text-muted-foreground">No jobs yet</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-muted">
        {items.map((item, i) => (
          <div
            key={item.label}
            role="presentation"
            title={`${item.label}: ${item.count}`}
            onMouseEnter={() => setActive(item.label)}
            onMouseLeave={() => setActive(null)}
            className="h-full rounded-full transition-opacity duration-200 cursor-pointer"
            style={{
              width: `${(item.count / total) * 100}%`,
              backgroundColor: `var(--chart-${(i % 5) + 1})`,
              opacity: active && active !== item.label ? 0.35 : 1,
            }}
          />
        ))}
      </div>

      <div className="space-y-0.5">
        {items.map((item, i) => {
          const Icon = breakdownIcons[item.label] ?? CircleHelp;
          const isHovered = active === item.label;

          return (
            <div
              key={item.label}
              onMouseEnter={() => setActive(item.label)}
              onMouseLeave={() => setActive(null)}
              className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 transition-colors cursor-pointer ${
                isHovered ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <Icon
                  className="size-3.5 shrink-0"
                  style={{ color: `var(--chart-${(i % 5) + 1})` }}
                  aria-hidden="true"
                />
                <span className="truncate text-xs">{item.label}</span>
              </span>
              <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
                <span className="text-xs font-semibold text-foreground">{item.count}</span>
                <span className="w-9 text-right text-xs text-muted-foreground">
                  {Math.round((item.count / total) * 100)}%
                </span>
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

const scoreBandColor: Record<string, string> = {
  Strong: "var(--success)",
  Fair: "var(--warning)",
  Weak: "var(--destructive)",
};

export function MatchScoreDistributionChart({ data }: { data: MatchScoreBand[] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);

  if (total === 0) {
    return <p className="py-4 text-center text-xs text-muted-foreground">No scored jobs yet</p>;
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={170}>
        <BarChart data={data} barCategoryGap="12%" margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
          <defs>
            <linearGradient id="gradStrong" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--success)" stopOpacity={0.85} />
              <stop offset="100%" stopColor="var(--success)" stopOpacity={0.25} />
            </linearGradient>
            <linearGradient id="gradFair" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--warning)" stopOpacity={0.85} />
              <stop offset="100%" stopColor="var(--warning)" stopOpacity={0.25} />
            </linearGradient>
            <linearGradient id="gradWeak" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--destructive)" stopOpacity={0.85} />
              <stop offset="100%" stopColor="var(--destructive)" stopOpacity={0.25} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
          <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)", opacity: 0.15 }} />
          <Bar dataKey="count" radius={[10, 10, 0, 0]} barSize={100} maxBarSize={130}>
            {data.map((entry) => {
              const fillUrl =
                entry.label === "Strong"
                  ? "url(#gradStrong)"
                  : entry.label === "Fair"
                    ? "url(#gradFair)"
                    : "url(#gradWeak)";
              return (
                <Cell
                  key={entry.label}
                  fill={fillUrl}
                  stroke={scoreBandColor[entry.label]}
                  strokeWidth={1.5}
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-3 flex items-center justify-center gap-4 text-xs">
        {data.map((entry) => {
          const share = total > 0 ? Math.round((entry.count / total) * 100) : 0;
          return (
            <div key={entry.label} className="flex items-center gap-1.5">
              <div className="size-2 rounded-full" style={{ backgroundColor: scoreBandColor[entry.label] }} />
              <span className="text-muted-foreground">{entry.label}</span>
              <span className="font-semibold tabular-nums text-foreground">{entry.count}</span>
              <span className="text-[11px] text-muted-foreground/80">({share}%)</span>
            </div>
          );
        })}
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
        {/* One tick per data point would crowd the axis once the trend is
            zero-filled to a full window — preserveStartEnd thins the rest to
            what actually fits instead of hardcoding a skip count tied to a
            30-day window that might not always be 30. */}
        <XAxis dataKey="date" tick={axisTick} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
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
