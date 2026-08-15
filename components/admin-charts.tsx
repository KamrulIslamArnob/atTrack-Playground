"use client";

import { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const statusColors: Record<string, string> = {
  saved: "#94A3B8",
  interested: "#3B82F6",
  preparing: "#F59E0B",
  applied: "#8B5CF6",
  interview: "#84cc16",
  offer: "#059669",
  accepted: "#047857",
  rejected: "#EF4444",
  withdrawn: "#6B7280",
};

const statusLabels: Record<string, string> = {
  saved: "Saved",
  interested: "Interested",
  preparing: "Preparing",
  applied: "Applied",
  interview: "Interview",
  offer: "Offer",
  accepted: "Accepted",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

const actionColors: Record<string, string> = {
  create: "#10B981",
  update: "#3B82F6",
  delete: "#EF4444",
  send: "#8B5CF6",
  upload: "#F59E0B",
  extract: "#06B6D4",
  sign_in: "#6366F1",
  sign_up: "#059669",
  sign_out: "#6B7280",
  ban: "#EF4444",
  unban: "#10B981",
  promote: "#8B5CF6",
  demote: "#F59E0B",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card/95 px-3 py-2 shadow-lg backdrop-blur-sm">
      <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((entry: any, index: number) => (
        <p key={index} className="text-sm font-semibold" style={{ color: entry.color }}>
          {entry.name}: {typeof entry.value === "number" ? entry.value.toLocaleString() : entry.value}
        </p>
      ))}
    </div>
  );
}

export function UsersTrendChart({ data }: { data: { date: string; count: number }[] }) {
  const [active, setActive] = useState(true);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <button
          onClick={() => setActive(!active)}
          className={`text-xs font-medium transition-colors ${active ? "text-primary" : "text-muted-foreground"}`}
        >
          {active ? "Showing" : "Hidden"}
        </button>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="gradientUsers" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} opacity={0.5} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "#9CA3AF" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#9CA3AF" }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} />
          {active && (
            <Area
              type="monotone"
              dataKey="count"
              name="Signups"
              stroke="#8B5CF6"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#gradientUsers)"
              dot={false}
              activeDot={{ r: 5, strokeWidth: 2, stroke: "#8B5CF6", fill: "#fff" }}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AiTrendChart({ data }: { data: { date: string; requests: number }[] }) {
  const [active, setActive] = useState(true);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <button
          onClick={() => setActive(!active)}
          className={`text-xs font-medium transition-colors ${active ? "text-primary" : "text-muted-foreground"}`}
        >
          {active ? "Showing" : "Hidden"}
        </button>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="gradientAi" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06B6D4" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#06B6D4" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} opacity={0.5} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "#9CA3AF" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#9CA3AF" }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} />
          {active && (
            <Area
              type="monotone"
              dataKey="requests"
              name="Requests"
              stroke="#06B6D4"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#gradientAi)"
              dot={false}
              activeDot={{ r: 5, strokeWidth: 2, stroke: "#06B6D4", fill: "#fff" }}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Stage names and colours arrive from board_lists, so a renamed or recoloured
 * list — and any list a user created themselves — shows up here as-is. There is
 * no local label or colour table to keep in sync.
 */
export function JobsStageChart({ data }: { data: { stage: string; count: number; color: string }[] }) {
  const chartData = useMemo(
    () =>
      data.map((d) => ({
        name: d.stage,
        value: d.count,
        fill: d.color,
      })),
    [data]
  );

  const total = useMemo(() => chartData.reduce((sum, d) => sum + d.value, 0), [chartData]);

  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 5, right: 20, left: 10, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} opacity={0.5} />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: "#9CA3AF" }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 11, fill: "#6B7280" }}
            axisLine={false}
            tickLine={false}
            width={80}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.02)" }} />
          <Bar dataKey="value" name="Jobs" radius={[0, 6, 6, 0]} barSize={20}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-3 border-t border-border pt-3">
        {chartData.map((item) => (
          <div key={item.name} className="flex items-center gap-1.5 text-xs">
            <div className="size-2 rounded-full" style={{ backgroundColor: item.fill }} />
            <span className="text-muted-foreground">{item.name}</span>
            <span className="font-medium">{item.value}</span>
            <span className="text-muted-foreground/60">
              ({total > 0 ? Math.round((item.value / total) * 100) : 0}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
