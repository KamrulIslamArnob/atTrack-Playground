"use client";

import {
  BarChart,
  Bar,
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
} from "recharts";

const statusColors: Record<string, string> = {
  saved: "#94A3B8",
  interested: "#3B82F6",
  preparing: "#F59E0B",
  applied: "#8B5CF6",
  interview: "#10B981",
  offer: "#059669",
  accepted: "#047857",
  rejected: "#EF4444",
  withdrawn: "#6B7280",
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
};

const tooltipStyle = {
  borderRadius: "12px",
  border: "1px solid #E5E7EB",
  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
  fontSize: "12px",
};

export function UsersTrendChart({ data }: { data: { date: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Area type="monotone" dataKey="count" stroke="#8B5CF6" fillOpacity={1} fill="url(#colorUsers)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function JobsStatusChart({ data }: { data: { status: string; count: number }[] }) {
  const chartData = data.map((d) => ({
    name: d.status,
    value: d.count,
    fill: statusColors[d.status] || "#6B7280",
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(0,0,0,0.02)" }} />
        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function AiTrendChart({ data }: { data: { date: string; requests: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="colorAi" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Area type="monotone" dataKey="requests" stroke="#6366F1" fillOpacity={1} fill="url(#colorAi)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function ActivityByActionChart({ data }: { data: { action: string; count: number }[] }) {
  const filtered = data.filter((d) => d.count > 0);
  const chartData = filtered.map((d) => ({
    name: d.action,
    value: d.count,
    fill: actionColors[d.action] || "#6B7280",
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={80}
          paddingAngle={3}
          dataKey="value"
          nameKey="name"
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
      </PieChart>
    </ResponsiveContainer>
  );
}
