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
  border: "1px solid #E5E7EB",
  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
  fontSize: "12px",
};

interface ChartDataItem {
  range?: string;
  count: number;
  fill: string;
  source?: string;
  location?: string;
  type?: string;
}

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
  const filled = stages.filter((s) => s.count > 0);

  return (
    <div>
      {/* One bar, one glance: how the whole search is distributed right now. */}
      <div className="flex h-3 w-full gap-1 overflow-hidden rounded-full bg-muted">
        {filled.map((stage, i) => (
          <div
            key={stage.id}
            role="presentation"
            title={`${stage.name}: ${stage.count}`}
            onMouseEnter={() => setActive(stage.id)}
            onMouseLeave={() => setActive(null)}
            className="stat-bar-grow h-full rounded-full transition-opacity duration-200"
            style={{
              width: `${(stage.count / total) * 100}%`,
              backgroundColor: stage.color,
              animationDelay: `${i * 60}ms`,
              opacity: active && active !== stage.id ? 0.3 : 1,
            }}
          />
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {stages.map((stage, i) => {
          const share = total > 0 ? Math.round((stage.count / total) * 100) : 0;
          const dim = stage.count === 0;
          return (
            <div
              key={stage.id}
              onMouseEnter={() => setActive(stage.id)}
              onMouseLeave={() => setActive(null)}
              className={`agent-fade-up micro-hover-lift rounded-xl border border-border bg-muted/40 p-3 transition-colors ${
                active === stage.id ? "border-primary/40" : ""
              } ${dim ? "opacity-55" : ""}`}
              style={{ animationDelay: `${i * 45}ms` }}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: stage.color }}
                />
                <span className="truncate text-[11px] text-muted-foreground">{stage.name}</span>
              </div>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className="text-xl font-bold tabular-nums leading-none">{stage.count}</span>
                <span className="text-[10px] text-muted-foreground">{share}%</span>
              </div>
              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="stat-bar-grow h-full rounded-full"
                  style={{
                    width: `${share}%`,
                    backgroundColor: stage.color,
                    animationDelay: `${i * 45 + 120}ms`,
                  }}
                />
              </div>
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

export function MatchScoreChart({ data }: { data: ChartDataItem[] }) {
  const filtered = data.filter((d) => d.count > 0);

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={filtered}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={80}
          paddingAngle={3}
          dataKey="count"
          nameKey="range"
        >
          {filtered.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function ApplicationTrendChart({ data }: { data: TrendData[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data} margin={{ top: 5, right: 5, left: -5, bottom: 0 }}>
        <defs>
          <linearGradient id="colorApplications" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorInterviews" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#84cc16" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#84cc16" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Area type="monotone" dataKey="applications" stroke="#8B5CF6" fillOpacity={1} fill="url(#colorApplications)" strokeWidth={2} />
        <Area type="monotone" dataKey="interviews" stroke="#84cc16" fillOpacity={1} fill="url(#colorInterviews)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function SourceChart({ data }: { data: ChartDataItem[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={45}
          outerRadius={70}
          paddingAngle={3}
          dataKey="count"
          nameKey="source"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function LocationChart({ data }: { data: ChartDataItem[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={45}
          outerRadius={70}
          paddingAngle={3}
          dataKey="count"
          nameKey="location"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function EmploymentTypeChart({ data }: { data: ChartDataItem[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={45}
          outerRadius={70}
          paddingAngle={3}
          dataKey="count"
          nameKey="type"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function McqScoreChart({ data }: { data: McqScoreData[] }) {
  return (
    <ResponsiveContainer width="100%" height={100}>
      <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Line type="monotone" dataKey="score" stroke="#F59E0B" strokeWidth={2} dot={{ fill: "#F59E0B", strokeWidth: 0, r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
