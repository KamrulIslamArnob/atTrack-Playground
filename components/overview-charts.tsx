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
  LineChart,
  Line,
} from "recharts";

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

const statusColors: Record<string, string> = {
  saved: "#94A3B8",
  interested: "#3B82F6",
  preparing: "#F59E0B",
  applied: "#8B5CF6",
  interview: "#84cc16",
  offer: "#65a30d",
  accepted: "#4d7c0f",
  rejected: "#EF4444",
  withdrawn: "#6B7280",
};

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

export function PipelineChart({ pipeline }: { pipeline: Record<string, number> }) {
  const chartData = Object.entries(pipeline).map(([key, value]) => ({
    name: statusLabels[key] || key,
    value,
    fill: statusColors[key] || "#6B7280",
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} margin={{ top: 5, right: 5, left: -5, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
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
