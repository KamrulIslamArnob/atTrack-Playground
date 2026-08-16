"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import {
  X, Mail, ChevronsUpDown, GripVertical, MoveLeft, MoveRight, Palette, Trash2, Briefcase, Building2, Laptop, Banknote, CircleDot, Calendar } from "lucide-react";
import { ExternalLinkIcon } from "@/components/ui/external-link";
import { ArrowUpIcon } from "@/components/ui/arrow-up";
import { ArrowDownIcon } from "@/components/ui/arrow-down";
import { RotateCCWIcon } from "@/components/ui/rotate-ccw";
import { CheckIcon } from "@/components/ui/check";
import { MapPinIcon } from "@/components/ui/map-pin";
import { ClockIcon } from "@/components/ui/clock";
import { SparklesIcon } from "@/components/ui/sparkles";
import { cn } from "@/lib/utils";
import { JOB_STATUS_LABELS, JOB_TIERS, type JobTier } from "@/lib/types/job";

interface JobListItem {
  id: string;
  title: string;
  status: string;
  location: string | null;
  salary_range: string | null;
  employment_type: string | null;
  work_location: string | null;
  deadline: string | null;
  application_url: string | null;
  application_email: string | null;
  match_score: number | null;
  match_reasoning: string | null;
  tier?: string | null;
  created_at: string;
  company: {
    name: string;
    location: string | null;
  } | null;
  applications: {
    id: string;
    status: string;
    applied_at: string | null;
  }[];
}

interface JobsGridProps {
  jobs: JobListItem[];
  total: number;
  initialSearch: string;
  initialStatus: string;
  page: number;
  totalPages: number;
  perPage: number;
}

const statusColors: Record<string, string> = {
  saved: "bg-muted text-muted-foreground",
  interested: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  preparing: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  applied: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
};

const statusLabels: Record<string, string> = JOB_STATUS_LABELS;

const statusOptions = ["saved", "interested", "preparing"];

function matchBadgeClass(score: number) {
  if (score >= 80) return "bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-400";
  if (score >= 50) return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
  return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
}

function formatDate(iso: string) {
  const norm = iso.trim().toLowerCase();
  if (norm === "asap") return "ASAP";
  if (norm === "unknown") return "Unknown";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

interface Row {
  job: JobListItem;
  displayStatus: string;
  dateLabel: string;
  dateValue: number | null;
}

function enrichJob(job: JobListItem): Row {
  const hasApplied = job.applications && job.applications.length > 0;
  const latestApplication = hasApplied ? job.applications[0] : null;
  const displayStatus = hasApplied && job.status === "saved" ? "applied" : job.status;

  const dateIso = latestApplication?.applied_at ?? job.deadline ?? null;
  let dateLabel = "—";
  if (latestApplication?.applied_at) {
    dateLabel = `Applied ${formatDate(latestApplication.applied_at)}`;
  } else if (job.deadline) {
    const norm = job.deadline.trim().toLowerCase();
    if (norm === "asap") dateLabel = "Apply ASAP";
    else if (norm === "unknown") dateLabel = "Unknown";
    else dateLabel = `Due ${formatDate(job.deadline)}`;
  }

  let dateValue: number | null = null;
  if (dateIso) {
    const norm = dateIso.trim().toLowerCase();
    if (norm === "asap") dateValue = 0;
    else if (norm === "unknown") dateValue = Infinity;
    else {
      const t = new Date(dateIso).getTime();
      dateValue = isNaN(t) ? null : t;
    }
  }

  return {
    job,
    displayStatus,
    dateLabel,
    dateValue,
  };
}

type SortKey =
  | "title"
  | "company"
  | "location"
  | "employment_type"
  | "work_location"
  | "salary_range"
  | "match_score"
  | "status"
  | "date";

type SortDir = "asc" | "desc";

interface ColumnDef {
  key: SortKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  className?: string;
}

const ALL_COLUMNS: ColumnDef[] = [
  { key: "title", label: "Title", icon: Briefcase, className: "min-w-[200px]" },
  { key: "company", label: "Company", icon: Building2, className: "min-w-[140px] max-w-[180px] truncate" },
  { key: "location", label: "Location", icon: MapPinIcon, className: "min-w-[160px] max-w-[200px] truncate" },
  { key: "employment_type", label: "Type", icon: ClockIcon },
  { key: "work_location", label: "Work", icon: Laptop },
  { key: "salary_range", label: "Salary", icon: Banknote, className: "min-w-[140px]" },
  { key: "match_score", label: "Match", icon: SparklesIcon },
  { key: "status", label: "Status", icon: CircleDot },
  { key: "date", label: "Date", icon: Calendar, className: "min-w-[140px]" },
];

const DEFAULT_COLUMN_KEYS: SortKey[] = ALL_COLUMNS.map((c) => c.key);

const DEFAULT_DIR: Record<SortKey, SortDir> = {
  title: "asc",
  company: "asc",
  location: "asc",
  employment_type: "asc",
  work_location: "asc",
  salary_range: "asc",
  match_score: "desc",
  status: "asc",
  date: "desc",
};

const COLOR_PALETTE = [
  { name: "Soft Red", value: "rgba(254, 226, 226, 0.6)" },
  { name: "Soft Amber", value: "rgba(254, 243, 199, 0.6)" },
  { name: "Soft Green", value: "rgba(220, 252, 231, 0.6)" },
  { name: "Soft Teal", value: "rgba(204, 251, 241, 0.6)" },
  { name: "Soft Blue", value: "rgba(219, 234, 254, 0.6)" },
  { name: "Soft Indigo", value: "rgba(224, 231, 255, 0.6)" },
  { name: "Soft Purple", value: "rgba(243, 232, 255, 0.6)" },
  { name: "Soft Pink", value: "rgba(252, 231, 243, 0.6)" },
  { name: "Soft Slate", value: "rgba(241, 245, 249, 0.6)" },
];

function sortValue(row: Row, key: SortKey): string | number | null {
  switch (key) {
    case "title":
      return row.job.title || null;
    case "company":
      return row.job.company?.name || null;
    case "location":
      return row.job.location || null;
    case "employment_type":
      return row.job.employment_type || null;
    case "work_location":
      return row.job.work_location || null;
    case "salary_range":
      return row.job.salary_range || null;
    case "match_score":
      return row.job.match_score;
    case "status":
      return statusLabels[row.displayStatus] ?? row.displayStatus;
    case "date":
      return row.dateValue;
  }
}

function compareRows(a: Row, b: Row, key: SortKey, dir: SortDir): number {
  const av = sortValue(a, key);
  const bv = sortValue(b, key);
  const aNull = av === null || av === "";
  const bNull = bv === null || bv === "";
  if (aNull && bNull) return 0;
  if (aNull) return 1;
  if (bNull) return -1;
  if (typeof av === "number" && typeof bv === "number") {
    return dir === "asc" ? av - bv : bv - av;
  }
  const cmp = String(av).localeCompare(String(bv));
  return dir === "asc" ? cmp : -cmp;
}

interface SortHeaderProps {
  label: string;
  columnKey: SortKey;
  icon?: React.ComponentType<{ className?: string }>;
  sortKey: SortKey | null;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  className?: string;
  isDragging?: boolean;
  isDragOver?: boolean;
  bgColor?: string;
  width?: number;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onResizeStart?: (e: React.MouseEvent) => void;
}

function SortHeader({
  label,
  columnKey,
  icon: Icon,
  sortKey,
  sortDir,
  onSort,
  className,
  isDragging,
  isDragOver,
  bgColor,
  width,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onContextMenu,
  onResizeStart,
}: SortHeaderProps) {
  const active = sortKey === columnKey;

  return (
    <th
      scope="col"
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onContextMenu={onContextMenu}
      style={{
        width: width ? `${width}px` : undefined,
        minWidth: width ? `${width}px` : undefined,
        backgroundColor: bgColor || undefined,
      }}
      className={cn(
        "group/th border-r border-border px-3 py-2.5 text-left last:border-r-0 select-none transition-colors relative",
        isDragging && "opacity-40 bg-primary/10",
        isDragOver && "border-l-2 border-l-primary bg-primary/20",
        className
      )}
    >
      <div className="flex items-center gap-1 min-w-0 pr-1.5">
        <span
          className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground inline-flex items-center shrink-0"
          title="Drag to reorder column"
        >
          <GripVertical className="size-3.5" />
        </span>
        <button
          type="button"
          onClick={() => onSort(columnKey)}
          className={cn(
            "group/btn inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide px-1.5 py-0.5 -mx-1.5 rounded-md transition-all duration-200 ease-out hover:scale-[1.04] active:scale-95 hover:bg-lime-500/10 hover:text-green-800 dark:hover:text-lime-400 truncate",
            active ? "text-foreground font-bold" : "text-muted-foreground"
          )}
        >
          {Icon && (
            <Icon className="size-3.5 shrink-0 opacity-70 group-hover/btn:opacity-100 group-hover/btn:scale-110 group-hover/btn:-rotate-6 group-hover/btn:text-green-800 dark:group-hover/btn:text-lime-400 transition-all duration-200" />
          )}
          <span>{label}</span>
          {active ? (
            sortDir === "asc" ? (
              <ArrowUpIcon className="size-3 shrink-0" aria-hidden="true" />
            ) : (
              <ArrowDownIcon className="size-3 shrink-0" aria-hidden="true" />
            )
          ) : (
            <ChevronsUpDown className="size-3 shrink-0 opacity-30 group-hover/btn:opacity-60" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Resize Handle */}
      <div
        onMouseDown={(e) => {
          e.stopPropagation();
          onResizeStart?.(e);
        }}
        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-primary/50 group-hover/th:bg-border/60 transition-colors z-20"
        title="Drag to resize column width"
      />
    </th>
  );
}

interface ContextMenuState {
  x: number;
  y: number;
  columnKey: SortKey;
  jobId?: string;
  jobTitle?: string;
}

export function JobsGrid({
  jobs,
  total,
  initialSearch,
  initialStatus,
  page,
  totalPages,
  perPage,
}: JobsGridProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Dynamic Column Order, Column Colors, Column Widths, and Row Colors state
  const [columnOrder, setColumnOrder] = useState<SortKey[]>(DEFAULT_COLUMN_KEYS);
  const [columnColors, setColumnColors] = useState<Record<string, string>>({});
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [rowColors, setRowColors] = useState<Record<string, string>>({});

  // Drag and Drop state
  const [draggedCol, setDraggedCol] = useState<SortKey | null>(null);
  const [dragOverCol, setDragOverCol] = useState<SortKey | null>(null);

  // Context Menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Hydrate from localStorage on client load
  useEffect(() => {
    try {
      const savedOrder = localStorage.getItem("attrack_jobs_column_order");
      if (savedOrder) {
        const parsed = JSON.parse(savedOrder) as SortKey[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          const validKeys = parsed.filter((k) => DEFAULT_COLUMN_KEYS.includes(k));
          const missingKeys = DEFAULT_COLUMN_KEYS.filter((k) => !validKeys.includes(k));
          setColumnOrder([...validKeys, ...missingKeys]);
        }
      }
      const savedColColors = localStorage.getItem("attrack_jobs_column_colors");
      if (savedColColors) {
        setColumnColors(JSON.parse(savedColColors));
      }
      const savedColWidths = localStorage.getItem("attrack_jobs_column_widths");
      if (savedColWidths) {
        setColumnWidths(JSON.parse(savedColWidths));
      }
      const savedRowColors = localStorage.getItem("attrack_jobs_row_colors");
      if (savedRowColors) {
        setRowColors(JSON.parse(savedRowColors));
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Close context menu on outside click or escape
  useEffect(() => {
    const handleClose = () => setContextMenu(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenu(null);
    };
    window.addEventListener("click", handleClose);
    window.addEventListener("scroll", handleClose, true);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("click", handleClose);
      window.removeEventListener("scroll", handleClose, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const updateParams = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== "all") {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      if (key !== "page") {
        params.delete("page");
      }
      router.push(`?${params.toString()}`);
    },
    [router, searchParams]
  );

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback(
    (value: string) => {
      setSearch(value);
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = setTimeout(() => {
        updateParams("search", value);
      }, 300);
    },
    [updateParams]
  );

  const handleStatusChange = useCallback(
    (value: string) => {
      setStatusFilter(value);
      updateParams("status", value);
    },
    [updateParams]
  );

  const handleHeaderSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(DEFAULT_DIR[key]);
    }
  };

  // Column Resizing Handler
  const handleResizeStart = (e: React.MouseEvent, columnKey: SortKey) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const targetHeader = (e.currentTarget as HTMLElement).parentElement;
    const startWidth = columnWidths[columnKey] || (targetHeader ? targetHeader.getBoundingClientRect().width : 140);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(70, Math.round(startWidth + deltaX));
      setColumnWidths((prev) => {
        const next = { ...prev, [columnKey]: newWidth };
        try {
          localStorage.setItem("attrack_jobs_column_widths", JSON.stringify(next));
        } catch {}
        return next;
      });
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Reorder column helper
  const moveColumn = useCallback(
    (key: SortKey, direction: "left" | "right") => {
      setColumnOrder((prev) => {
        const index = prev.indexOf(key);
        if (index === -1) return prev;
        const targetIndex = direction === "left" ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= prev.length) return prev;
        const newOrder = [...prev];
        const [moved] = newOrder.splice(index, 1);
        newOrder.splice(targetIndex, 0, moved);
        try {
          localStorage.setItem("attrack_jobs_column_order", JSON.stringify(newOrder));
        } catch {}
        return newOrder;
      });
    },
    []
  );

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, key: SortKey) => {
    e.dataTransfer.setData("text/plain", key);
    e.dataTransfer.effectAllowed = "move";
    setDraggedCol(key);
  };

  const handleDragOver = (e: React.DragEvent, key: SortKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverCol !== key) {
      setDragOverCol(key);
    }
  };

  const handleDrop = (e: React.DragEvent, targetKey: SortKey) => {
    e.preventDefault();
    if (!draggedCol || draggedCol === targetKey) {
      setDraggedCol(null);
      setDragOverCol(null);
      return;
    }
    setColumnOrder((prev) => {
      const fromIndex = prev.indexOf(draggedCol);
      const toIndex = prev.indexOf(targetKey);
      if (fromIndex === -1 || toIndex === -1) return prev;
      const newOrder = [...prev];
      const [moved] = newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, moved);
      try {
        localStorage.setItem("attrack_jobs_column_order", JSON.stringify(newOrder));
      } catch {}
      return newOrder;
    });
    setDraggedCol(null);
    setDragOverCol(null);
  };

  const handleDragEnd = () => {
    setDraggedCol(null);
    setDragOverCol(null);
  };

  // Color management
  const setColumnColor = (key: SortKey, color: string) => {
    setColumnColors((prev) => {
      const next = { ...prev };
      if (!color) {
        delete next[key];
      } else {
        next[key] = color;
      }
      try {
        localStorage.setItem("attrack_jobs_column_colors", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const setRowColor = (jobId: string, color: string) => {
    setRowColors((prev) => {
      const next = { ...prev };
      if (!color) {
        delete next[jobId];
      } else {
        next[jobId] = color;
      }
      try {
        localStorage.setItem("attrack_jobs_row_colors", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const resetColumnOrder = () => {
    setColumnOrder(DEFAULT_COLUMN_KEYS);
    try {
      localStorage.removeItem("attrack_jobs_column_order");
    } catch {}
  };

  const resetColumnWidths = () => {
    setColumnWidths({});
    try {
      localStorage.removeItem("attrack_jobs_column_widths");
    } catch {}
  };

  const resetAllColors = () => {
    setColumnColors({});
    setRowColors({});
    try {
      localStorage.removeItem("attrack_jobs_column_colors");
      localStorage.removeItem("attrack_jobs_row_colors");
    } catch {}
  };

  // Context Menu trigger
  const handleContextMenu = (
    e: React.MouseEvent,
    columnKey: SortKey,
    jobId?: string,
    jobTitle?: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const x = Math.min(e.clientX, window.innerWidth - 260);
    const y = Math.min(e.clientY, window.innerHeight - 380);
    setContextMenu({ x, y, columnKey, jobId, jobTitle });
  };

  const hasActiveFilters = initialStatus !== "all" || initialSearch !== "";

  const rows = useMemo(() => {
    const enriched = jobs.map(enrichJob);
    if (!sortKey) return enriched;
    return [...enriched].sort((a, b) => compareRows(a, b, sortKey, sortDir));
  }, [jobs, sortKey, sortDir]);

  // Lookup map for column definition
  const columnDefMap = useMemo(() => {
    const map = new Map<SortKey, ColumnDef>();
    ALL_COLUMNS.forEach((c) => map.set(c.key, c));
    return map;
  }, []);

  // Helper to render individual table cell by column key
  const renderCellContent = (key: SortKey, row: Row) => {
    const { job, displayStatus, dateLabel } = row;
    switch (key) {
      case "title":
        return (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Link
              href={`/jobs/${job.id}`}
              className="font-semibold hover:text-green-800 dark:hover:text-lime-400 transition-all duration-200 ease-out hover:translate-x-0.5 inline-block"
            >
              {job.title}
            </Link>
            {job.tier && JOB_TIERS[job.tier as JobTier] && (
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold tracking-tight shadow-2xs",
                  JOB_TIERS[job.tier as JobTier].badgeClass
                )}
                title={`${JOB_TIERS[job.tier as JobTier].label} · ${JOB_TIERS[job.tier as JobTier].description}`}
              >
                <span
                  className="size-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: JOB_TIERS[job.tier as JobTier].dotColor }}
                />
                {JOB_TIERS[job.tier as JobTier].label}
              </span>
            )}
          </div>
        );
      case "company":
        return job.company?.name ?? "Unknown company";
      case "location":
        return job.location ?? "—";
      case "employment_type":
        return job.employment_type ? (
          <span className="whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {job.employment_type}
          </span>
        ) : (
          <span className="text-muted-foreground/50">—</span>
        );
      case "work_location":
        return job.work_location ? (
          <span className="whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {job.work_location}
          </span>
        ) : (
          <span className="text-muted-foreground/50">—</span>
        );
      case "salary_range":
        return job.salary_range || <span className="text-muted-foreground/50">Unspecified</span>;
      case "match_score":
        return job.match_score != null ? (
          <span
            className={cn(
              "whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-medium",
              matchBadgeClass(job.match_score)
            )}
            title={job.match_reasoning ?? undefined}
          >
            {job.match_score}%
          </span>
        ) : (
          <span className="text-muted-foreground/50">—</span>
        );
      case "status":
        return (
          <span
            className={cn(
              "whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-medium",
              statusColors[displayStatus] ?? "bg-muted text-muted-foreground"
            )}
          >
            {displayStatus === "applied" ? "Applied" : statusLabels[displayStatus] ?? displayStatus}
          </span>
        );
      case "date":
        return dateLabel;
    }
  };

  return (
    <div className="space-y-4">
      {/* Active filters & Table Customization actions — these remain here,
          the search/filter/pagination controls are now in <JobsToolbar>. */}

      {/* Active filters & Table Customization actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {hasActiveFilters ? (
          <div className="flex items-center gap-2">
            {initialSearch && (
              <span className="inline-flex items-center gap-1 rounded-2xl border border-lime-500/50 bg-lime-400/25 px-2.5 py-1 text-xs font-semibold text-lime-950 dark:border-lime-400/40 dark:bg-lime-500/20 dark:text-lime-200">
                &quot;{initialSearch}&quot;
                <button onClick={() => { setSearch(""); updateParams("search", ""); }} className="ml-0.5">
                  <X className="size-3 text-lime-900 dark:text-lime-300" />
                </button>
              </span>
            )}
            {initialStatus !== "all" && (
              <span className="inline-flex items-center gap-1 rounded-2xl border border-lime-500/50 bg-lime-400/25 px-2.5 py-1 text-xs font-semibold text-lime-950 capitalize dark:border-lime-400/40 dark:bg-lime-500/20 dark:text-lime-200">
                {statusLabels[initialStatus] ?? initialStatus}
                <button onClick={() => handleStatusChange("all")} className="ml-0.5">
                  <X className="size-3 text-lime-900 dark:text-lime-300" />
                </button>
              </span>
            )}
            <button
              onClick={() => {
                setSearch("");
                router.push("/jobs");
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear all
            </button>
          </div>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-2 text-xs text-muted-foreground ml-auto">
          {Object.keys(columnWidths).length > 0 && (
            <button
              onClick={resetColumnWidths}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              title="Reset column widths to default"
            >
              <RotateCCWIcon className="size-3" />
              Reset Widths
            </button>
          )}
          {(Object.keys(columnColors).length > 0 || Object.keys(rowColors).length > 0) && (
            <button
              onClick={resetAllColors}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
              title="Reset all custom column and row colors"
            >
              <RotateCCWIcon className="size-3" />
              Reset Colors
            </button>
          )}
          {JSON.stringify(columnOrder) !== JSON.stringify(DEFAULT_COLUMN_KEYS) && (
            <button
              onClick={resetColumnOrder}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              title="Reset column order to default"
            >
              <RotateCCWIcon className="size-3" />
              Reset Columns
            </button>
          )}
        </div>
      </div>

      {/* Results count */}
      <div className="text-xs text-muted-foreground">
        {total} job{total !== 1 ? "s" : ""} found
      </div>

      {/* Table */}
      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-border relative">
          <table className="w-full border-collapse text-sm select-none">
            <thead>
              <tr className="border-b border-border bg-muted/60">
                {columnOrder.map((key) => {
                  const col = columnDefMap.get(key);
                  if (!col) return null;
                  return (
                    <SortHeader
                      key={key}
                      label={col.label}
                      columnKey={key}
                      icon={col.icon}
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={handleHeaderSort}
                      className={col.className}
                      isDragging={draggedCol === key}
                      isDragOver={dragOverCol === key}
                      bgColor={columnColors[key]}
                      width={columnWidths[key]}
                      onDragStart={(e) => handleDragStart(e, key)}
                      onDragOver={(e) => handleDragOver(e, key)}
                      onDrop={(e) => handleDrop(e, key)}
                      onDragEnd={handleDragEnd}
                      onContextMenu={(e) => handleContextMenu(e, key)}
                      onResizeStart={(e) => handleResizeStart(e, key)}
                    />
                  );
                })}
                <th scope="col" className="px-3 py-2.5 w-10">
                  <span className="sr-only">Link</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const { job } = row;
                const rowBg = rowColors[job.id];
                return (
                  <tr
                    key={job.id}
                    style={rowBg ? { backgroundColor: rowBg } : undefined}
                    className={cn(
                      "group relative border-b border-border/60 last:border-b-0 transition-colors",
                      !rowBg && "odd:bg-card even:bg-muted/30 hover:bg-primary/5"
                    )}
                  >
                    {columnOrder.map((key) => {
                      const col = columnDefMap.get(key);
                      if (!col) return null;
                      const colBg = columnColors[key];
                      const colWidth = columnWidths[key];
                      const isTitle = key === "title";
                      const isMeta = key === "company" || key === "location" || key === "salary_range" || key === "date";

                      return (
                        <td
                          key={key}
                          onContextMenu={(e) => handleContextMenu(e, key, job.id, job.title)}
                          style={{
                            width: colWidth ? `${colWidth}px` : undefined,
                            minWidth: colWidth ? `${colWidth}px` : undefined,
                            backgroundColor: colBg && !rowBg ? colBg : undefined,
                          }}
                          className={cn(
                            "border-r border-border px-3 py-3 last:border-r-0",
                            isTitle && "font-semibold",
                            isMeta && "text-muted-foreground",
                            key === "date" && "whitespace-nowrap text-xs text-muted-foreground",
                            col.className
                          )}
                        >
                          {renderCellContent(key, row)}
                        </td>
                      );
                    })}
                    <td className="relative z-10 px-3 py-3 text-right">
                      {job.application_url && (
                        <a
                          href={job.application_url}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="Open application link"
                          className="group/ext inline-flex p-1 rounded-md text-muted-foreground/50 transition-all duration-150 ease-out hover:text-green-800 dark:hover:text-lime-400 hover:bg-muted active:scale-95"
                        >
                          <ExternalLinkIcon className="size-3.5 transition-transform duration-150 ease-out group-hover/ext:translate-x-0.5 group-hover/ext:-translate-y-0.5" />
                        </a>
                      )}
                      {!job.application_url && job.application_email && (
                        <a
                          href={`mailto:${job.application_email}`}
                          aria-label="Email application contact"
                          className="group/ext inline-flex p-1 rounded-md text-muted-foreground/50 transition-all duration-150 ease-out hover:text-green-800 dark:hover:text-lime-400 hover:bg-muted active:scale-95"
                        >
                          <Mail className="size-3.5 transition-transform duration-150 ease-out group-hover/ext:scale-110" />
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Context Menu Overlay */}
          {contextMenu && (
            <div
              style={{ top: contextMenu.y, left: contextMenu.x }}
              onClick={(e) => e.stopPropagation()}
              className="fixed z-50 min-w-[240px] rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-xl animate-in fade-in-50 zoom-in-95"
            >
              {/* Column Header section */}
              <div className="mb-2 pb-2 border-b border-border space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                  <span className="truncate">Column: {columnDefMap.get(contextMenu.columnKey)?.label}</span>
                  <div className="flex items-center gap-1">
                    <button
                      disabled={columnOrder.indexOf(contextMenu.columnKey) === 0}
                      onClick={() => {
                        moveColumn(contextMenu.columnKey, "left");
                        setContextMenu(null);
                      }}
                      title="Move Left"
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      <MoveLeft className="size-3.5" />
                    </button>
                    <button
                      disabled={columnOrder.indexOf(contextMenu.columnKey) === columnOrder.length - 1}
                      onClick={() => {
                        moveColumn(contextMenu.columnKey, "right");
                        setContextMenu(null);
                      }}
                      title="Move Right"
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      <MoveRight className="size-3.5" />
                    </button>
                  </div>
                </div>

                {/* Column color swatches */}
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase font-medium tracking-wider">
                    Column Color
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    {COLOR_PALETTE.map((p) => (
                      <button
                        key={p.name}
                        onClick={() => {
                          setColumnColor(contextMenu.columnKey, p.value);
                          setContextMenu(null);
                        }}
                        style={{ backgroundColor: p.value }}
                        title={p.name}
                        className={cn(
                          "size-5 rounded-full border border-border/80 transition-transform hover:scale-110 flex items-center justify-center",
                          columnColors[contextMenu.columnKey] === p.value && "ring-2 ring-primary ring-offset-1"
                        )}
                      >
                        {columnColors[contextMenu.columnKey] === p.value && (
                          <CheckIcon className="size-3 text-foreground" />
                        )}
                      </button>
                    ))}
                    {/* Custom Color Input */}
                    <label
                      title="Custom Color"
                      className="size-5 rounded-full border border-border/80 cursor-pointer overflow-hidden flex items-center justify-center bg-gradient-to-br from-red-400 via-green-400 to-blue-500 hover:scale-110 transition-transform"
                    >
                      <input
                        type="color"
                        className="opacity-0 absolute size-0"
                        onChange={(e) => {
                          setColumnColor(contextMenu.columnKey, e.target.value);
                          setContextMenu(null);
                        }}
                      />
                      <Palette className="size-3 text-white drop-shadow" />
                    </label>
                    {columnColors[contextMenu.columnKey] && (
                      <button
                        onClick={() => {
                          setColumnColor(contextMenu.columnKey, "");
                          setContextMenu(null);
                        }}
                        title="Clear Column Color"
                        className="p-0.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Row Color section if clicked on row */}
              {contextMenu.jobId && (
                <div className="mb-2 pb-2 border-b border-border space-y-1.5">
                  <div className="text-xs font-semibold text-foreground truncate">
                    Row: {contextMenu.jobTitle || "Job"}
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground uppercase font-medium tracking-wider">
                      Row Color
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      {COLOR_PALETTE.map((p) => (
                        <button
                          key={p.name}
                          onClick={() => {
                            setRowColor(contextMenu.jobId!, p.value);
                            setContextMenu(null);
                          }}
                          style={{ backgroundColor: p.value }}
                          title={p.name}
                          className={cn(
                            "size-5 rounded-full border border-border/80 transition-transform hover:scale-110 flex items-center justify-center",
                            rowColors[contextMenu.jobId!] === p.value && "ring-2 ring-primary ring-offset-1"
                          )}
                        >
                          {rowColors[contextMenu.jobId!] === p.value && (
                            <CheckIcon className="size-3 text-foreground" />
                          )}
                        </button>
                      ))}
                      {/* Custom Color Input */}
                      <label
                        title="Custom Color"
                        className="size-5 rounded-full border border-border/80 cursor-pointer overflow-hidden flex items-center justify-center bg-gradient-to-br from-red-400 via-green-400 to-blue-500 hover:scale-110 transition-transform"
                      >
                        <input
                          type="color"
                          className="opacity-0 absolute size-0"
                          onChange={(e) => {
                            setRowColor(contextMenu.jobId!, e.target.value);
                            setContextMenu(null);
                          }}
                        />
                        <Palette className="size-3 text-white drop-shadow" />
                      </label>
                      {rowColors[contextMenu.jobId!] && (
                        <button
                          onClick={() => {
                            setRowColor(contextMenu.jobId!, "");
                            setContextMenu(null);
                          }}
                          title="Clear Row Color"
                          className="p-0.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* General Options */}
              <div className="space-y-1">
                <button
                  onClick={() => {
                    resetColumnOrder();
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-2 py-1 text-xs rounded hover:bg-muted text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
                >
                  <RotateCCWIcon className="size-3" />
                  Reset Column Order
                </button>
                {Object.keys(columnWidths).length > 0 && (
                  <button
                    onClick={() => {
                      resetColumnWidths();
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-2 py-1 text-xs rounded hover:bg-muted text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
                  >
                    <RotateCCWIcon className="size-3" />
                    Reset Column Widths
                  </button>
                )}
                <button
                  onClick={() => {
                    resetAllColors();
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-2 py-1 text-xs rounded hover:bg-muted text-destructive/80 hover:text-destructive flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 className="size-3" />
                  Clear All Table Colors
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-12 text-center">
          <p className="text-sm text-muted-foreground">
            {hasActiveFilters ? "No jobs match your filters." : "No jobs yet."}
          </p>
        </div>
      )}
    </div>
  );
}
