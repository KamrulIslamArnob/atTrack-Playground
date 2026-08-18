"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { deleteDocument, setDefaultDocument, getSignedUrl, openDocumentFolder } from "@/lib/actions/documents";
import type { Document } from "@/lib/actions/documents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/components/ui/select";
import {
  FileText, Folder, Trash2, Star, ChevronsUpDown, GripVertical, MoveLeft, MoveRight, Palette, Hash, Tag, Calendar, Code2 } from "lucide-react";
import { DownloadIcon } from "@/components/ui/download";
import { SearchIcon } from "@/components/ui/search";
import { XIcon } from "@/components/ui/x";
import { ArrowUpIcon } from "@/components/ui/arrow-up";
import { ArrowDownIcon } from "@/components/ui/arrow-down";
import { RotateCCWIcon } from "@/components/ui/rotate-ccw";
import { CheckIcon } from "@/components/ui/check";
import { SparklesIcon } from "@/components/ui/sparkles";
import { Link2Icon } from "@/components/ui/link-2";
import { ExternalLinkIcon } from "@/components/ui/external-link";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

interface DocumentsListProps {
  documents: Document[];
}

const typeLabels: Record<string, string> = {
  resume: "Resume",
  cover_letter: "Cover Letter",
  other: "Other",
};

const typeColors: Record<string, string> = {
  resume: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  cover_letter: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  other: "bg-muted text-muted-foreground",
};

type SortKey = "index" | "name" | "type" | "uploaded" | "ai_extracted";
type SortDir = "asc" | "desc";

interface ColumnDef {
  key: SortKey;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  isDraggable?: boolean;
  className?: string;
  /** Share of table width (%) this column gets when the user hasn't dragged a custom width. Sums to 100 with ACTIONS_DEFAULT_PCT. */
  defaultPct: number;
}

const ALL_COLUMNS: ColumnDef[] = [
  { key: "index", label: "", icon: Hash, isDraggable: false, className: "text-xs", defaultPct: 6 },
  { key: "name", label: "Name", icon: FileText, defaultPct: 32 },
  { key: "type", label: "Type", icon: Tag, defaultPct: 13 },
  { key: "uploaded", label: "Uploaded", icon: Calendar, defaultPct: 15 },
  { key: "ai_extracted", label: "AI Extracted", icon: SparklesIcon, defaultPct: 19 },
];

// Remaining share after the columns above, reserved for the fixed Actions column.
const ACTIONS_DEFAULT_PCT = 15;

const DEFAULT_COLUMN_KEYS: SortKey[] = ALL_COLUMNS.map((c) => c.key);

const DEFAULT_DIR: Record<SortKey, SortDir> = {
  index: "asc",
  name: "asc",
  type: "asc",
  uploaded: "desc",
  ai_extracted: "desc",
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

interface Row {
  doc: Document;
  originalIndex: number;
}

function sortValue(row: Row, key: SortKey): string | number | null {
  const { doc, originalIndex } = row;
  switch (key) {
    case "index":
      return originalIndex + 1;
    case "name":
      return doc.name || null;
    case "type":
      return typeLabels[doc.type] ?? doc.type;
    case "uploaded":
      return doc.created_at ? new Date(doc.created_at).getTime() : null;
    case "ai_extracted":
      return doc.match_data
        ? doc.match_data.skills.length + doc.match_data.experience.length
        : null;
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
  isDraggable?: boolean;
  sortKey: SortKey | null;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  className?: string;
  isDragging?: boolean;
  isDragOver?: boolean;
  bgColor?: string;
  /** CSS width value, e.g. "140px" (user-resized) or "32%" (proportional default). */
  width?: string;
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
  isDraggable = true,
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
      draggable={isDraggable}
      onDragStart={isDraggable ? onDragStart : undefined}
      onDragOver={isDraggable ? onDragOver : undefined}
      onDrop={isDraggable ? onDrop : undefined}
      onDragEnd={isDraggable ? onDragEnd : undefined}
      onContextMenu={onContextMenu}
      style={{
        width,
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
        {isDraggable && (
          <span
            className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground inline-flex items-center shrink-0"
            title="Drag to reorder column"
          >
            <GripVertical className="size-3.5" />
          </span>
        )}
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
          {label ? <span>{label}</span> : null}
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
  docId?: string;
  docName?: string;
}

export function DocumentsList({ documents }: DocumentsListProps) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const router = useRouter();
  const { confirm, dialog } = useConfirm();

  // SearchIcon and filter state
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  // Sort state
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
      const savedOrder = localStorage.getItem("attrack_documents_column_order");
      if (savedOrder) {
        const parsed = JSON.parse(savedOrder) as SortKey[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          const validKeys = parsed.filter((k) => DEFAULT_COLUMN_KEYS.includes(k));
          const missingKeys = DEFAULT_COLUMN_KEYS.filter((k) => !validKeys.includes(k));
          setColumnOrder([...validKeys, ...missingKeys]);
        }
      }
      const savedColColors = localStorage.getItem("attrack_documents_column_colors");
      if (savedColColors) {
        setColumnColors(JSON.parse(savedColColors));
      }
      const savedColWidths = localStorage.getItem("attrack_documents_column_widths");
      if (savedColWidths) {
        setColumnWidths(JSON.parse(savedColWidths));
      }
      const savedRowColors = localStorage.getItem("attrack_documents_row_colors");
      if (savedRowColors) {
        setRowColors(JSON.parse(savedRowColors));
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Close context menu on outside click or escape key
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

  const handleDelete = async (id: string, name: string) => {
    const confirmed = await confirm({
      title: "Delete this document?",
      description: `"${name}" will be permanently deleted. This can't be undone.`,
      confirmText: "Delete document",
      variant: "destructive",
    });
    if (!confirmed) return;
    setPendingId(id);
    try {
      await deleteDocument(id);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setPendingId(null);
    }
  };

  const handleSetDefault = async (id: string) => {
    setPendingId(id);
    try {
      await setDefaultDocument(id);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to set default");
    } finally {
      setPendingId(null);
    }
  };

  const handleDownload = async (doc: Document) => {
    try {
      if (doc.generated_kind === "external_link") {
        window.open(doc.file_path, "_blank");
        toast.success("Opened external link");
        return;
      }
      if (doc.generated_kind === "latex_raw") {
        const blob = new Blob([doc.content ?? ""], { type: "text/x-tex;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = doc.name.endsWith(".tex") ? doc.name : `${doc.name.replace(/[^a-zA-Z0-9.-]/g, "_")}.tex`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Downloaded .TEX code file");
        return;
      }
      if (doc.content || doc.file_path.startsWith("generated/")) {
        const blob = new Blob([doc.content ?? ""], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${doc.name.replace(/[^a-zA-Z0-9.-]/g, "_")}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Downloaded document text");
        return;
      }
      const url = doc.file_path.startsWith("/") ? doc.file_path : await getSignedUrl(doc.file_path);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.name.endsWith(".pdf") ? doc.name : `${doc.name}.pdf`;
      a.click();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to download");
    }
  };

  const handleOpenFolder = async (id: string, doc?: Document) => {
    if (doc?.generated_kind === "external_link") {
      window.open(doc.file_path, "_blank");
      return;
    }
    setPendingId(id);
    try {
      await openDocumentFolder(id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to open folder");
    } finally {
      setPendingId(null);
    }
  };

  const handleHeaderSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(DEFAULT_DIR[key]);
    }
  };

  // Column Resizing Handler with high-performance RAF and deferred localStorage persistence
  const handleResizeStart = (e: React.MouseEvent, columnKey: SortKey) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const targetHeader = (e.currentTarget as HTMLElement).parentElement;
    const startWidth = columnWidths[columnKey] || (targetHeader ? targetHeader.getBoundingClientRect().width : 140);
    let latestWidths: Record<string, number> = { ...columnWidths };
    let rafId: number | null = null;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(50, Math.round(startWidth + deltaX));
      
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        setColumnWidths((prev) => {
          latestWidths = { ...prev, [columnKey]: newWidth };
          return latestWidths;
        });
      });
    };

    const handleMouseUp = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      try {
        localStorage.setItem("attrack_documents_column_widths", JSON.stringify(latestWidths));
      } catch {}
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
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
          localStorage.setItem("attrack_documents_column_order", JSON.stringify(newOrder));
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
        localStorage.setItem("attrack_documents_column_order", JSON.stringify(newOrder));
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
        localStorage.setItem("attrack_documents_column_colors", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const setRowColor = (docId: string, color: string) => {
    setRowColors((prev) => {
      const next = { ...prev };
      if (!color) {
        delete next[docId];
      } else {
        next[docId] = color;
      }
      try {
        localStorage.setItem("attrack_documents_row_colors", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const resetColumnOrder = () => {
    setColumnOrder(DEFAULT_COLUMN_KEYS);
    try {
      localStorage.removeItem("attrack_documents_column_order");
    } catch {}
  };

  const resetColumnWidths = () => {
    setColumnWidths({});
    try {
      localStorage.removeItem("attrack_documents_column_widths");
    } catch {}
  };

  const resetAllColors = () => {
    setColumnColors({});
    setRowColors({});
    try {
      localStorage.removeItem("attrack_documents_column_colors");
      localStorage.removeItem("attrack_documents_row_colors");
    } catch {}
  };

  // Context Menu trigger
  const handleContextMenu = (
    e: React.MouseEvent,
    columnKey: SortKey,
    docId?: string,
    docName?: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const x = Math.min(e.clientX, window.innerWidth - 260);
    const y = Math.min(e.clientY, window.innerHeight - 380);
    setContextMenu({ x, y, columnKey, docId, docName });
  };

  // Filter & sort rows
  const filteredRows = useMemo(() => {
    return documents
      .map((doc, index) => ({ doc, originalIndex: index }))
      .filter(({ doc }) => {
        if (search.trim()) {
          const q = search.toLowerCase();
          if (!doc.name.toLowerCase().includes(q)) return false;
        }
        if (typeFilter !== "all" && doc.type !== typeFilter) {
          return false;
        }
        return true;
      });
  }, [documents, search, typeFilter]);

  const rows = useMemo(() => {
    if (!sortKey) return filteredRows;
    return [...filteredRows].sort((a, b) => compareRows(a, b, sortKey, sortDir));
  }, [filteredRows, sortKey, sortDir]);

  // Lookup map for column definitions
  const columnDefMap = useMemo(() => {
    const map = new Map<SortKey, ColumnDef>();
    ALL_COLUMNS.forEach((c) => map.set(c.key, c));
    return map;
  }, []);

  const hasActiveFilters = search !== "" || typeFilter !== "all";

  // Helper to render individual cell content
  const renderCellContent = (key: SortKey, row: Row) => {
    const { doc, originalIndex } = row;
    switch (key) {
      case "index":
        return <span className="text-muted-foreground text-xs">{originalIndex + 1}</span>;
      case "name":
        return (
          <div className="flex items-center gap-2">
            {doc.generated_kind === "external_link" ? (
              <Link2Icon className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : doc.generated_kind === "latex_raw" ? (
              <Code2 className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
            ) : doc.generated_kind ? (
              <SparklesIcon className="size-4 text-purple-500 shrink-0" />
            ) : (
              <FileText className="size-4 text-muted-foreground shrink-0" />
            )}

            {doc.generated_kind === "external_link" ? (
              <a
                href={doc.file_path}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium hover:text-green-800 dark:hover:text-lime-400 transition-all duration-200 ease-out hover:translate-x-0.5 inline-flex items-center gap-1 truncate"
                title={`Open external link: ${doc.file_path}`}
              >
                <span className="truncate">{doc.name}</span>
                <ExternalLinkIcon className="size-3 text-muted-foreground shrink-0 opacity-70" />
              </a>
            ) : (
              <Link
                href={doc.builder_data ? `/documents/builder/${doc.id}` : `/documents/${doc.id}`}
                className="font-medium hover:text-green-800 dark:hover:text-lime-400 transition-all duration-200 ease-out hover:translate-x-0.5 inline-block truncate"
              >
                {doc.name}
              </Link>
            )}

            {doc.is_default && (
              <span className="inline-flex items-center gap-1 rounded-2xl bg-lime-100 dark:bg-lime-950/50 px-2 py-0.5 text-[10px] font-semibold text-lime-900 dark:text-lime-300 shrink-0 border border-lime-300/60 dark:border-lime-700/40">
                <Star className="size-2.5 fill-lime-600 dark:fill-lime-400 text-lime-600 dark:text-lime-400" />
                Default
              </span>
            )}
          </div>
        );
      case "type":
        return (
          <span
            className={cn(
              "inline-block rounded-2xl px-2 py-0.5 text-[10px] font-medium whitespace-nowrap capitalize",
              doc.generated_kind
                ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                : typeColors[doc.type] ?? "bg-muted text-muted-foreground"
            )}
          >
            {doc.generated_kind
              ? doc.generated_kind.replace(/_/g, " ")
              : typeLabels[doc.type] ?? doc.type}
          </span>
        );
      case "uploaded":
        return (
          <span className="text-muted-foreground text-xs whitespace-nowrap">
            {new Date(doc.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        );
      case "ai_extracted":
        return doc.match_data ? (
          <span className="text-xs text-muted-foreground">
            {doc.match_data.skills.length} skills, {doc.match_data.experience.length} roles
          </span>
        ) : (
          <span className="text-xs text-muted-foreground/50">-</span>
        );
    }
  };

  if (documents.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* SearchIcon and filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative w-full lg:w-72">
          <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by document name..."
            className="h-10 pl-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-xs text-muted-foreground">Type</span>
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v ?? "all")}>
            <SelectTrigger className="h-10 w-full lg:w-[150px]">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="resume">Resume</SelectItem>
              <SelectItem value="cover_letter">Cover Letter</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Active filters & Table Customization actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {hasActiveFilters ? (
          <div className="flex items-center gap-2">
            {search && (
              <span className="inline-flex items-center gap-1 rounded-2xl bg-lime-100 dark:bg-lime-900/30 px-2.5 py-1 text-xs font-medium text-lime-900 dark:text-lime-300">
                &quot;{search}&quot;
                <button onClick={() => setSearch("")} className="ml-0.5">
                  <XIcon className="size-3" />
                </button>
              </span>
            )}
            {typeFilter !== "all" && (
              <span className="inline-flex items-center gap-1 rounded-2xl bg-lime-100 dark:bg-lime-900/30 px-2.5 py-1 text-xs font-medium text-lime-900 dark:text-lime-300 capitalize">
                {typeLabels[typeFilter] ?? typeFilter}
                <button onClick={() => setTypeFilter("all")} className="ml-0.5">
                  <XIcon className="size-3" />
                </button>
              </span>
            )}
            <button
              onClick={() => {
                setSearch("");
                setTypeFilter("all");
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
        {rows.length} document{rows.length !== 1 ? "s" : ""} found
      </div>

      {/* Table */}
      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-border relative">
          <table className="w-full table-fixed border-collapse text-sm select-none">
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
                      isDraggable={col.isDraggable}
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={handleHeaderSort}
                      className={col.className}
                      isDragging={draggedCol === key}
                      isDragOver={dragOverCol === key}
                      bgColor={columnColors[key]}
                      width={columnWidths[key] ? `${columnWidths[key]}px` : `${col.defaultPct}%`}
                      onDragStart={(e) => handleDragStart(e, key)}
                      onDragOver={(e) => handleDragOver(e, key)}
                      onDrop={(e) => handleDrop(e, key)}
                      onDragEnd={handleDragEnd}
                      onContextMenu={(e) => handleContextMenu(e, key)}
                      onResizeStart={(e) => handleResizeStart(e, key)}
                    />
                  );
                })}
                <th
                  scope="col"
                  style={{ width: `${ACTIONS_DEFAULT_PCT}%` }}
                  className="px-4 py-2.5 font-semibold uppercase text-[11px] text-muted-foreground text-right tracking-wide"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const { doc } = row;
                const rowBg = rowColors[doc.id];
                return (
                  <tr
                    key={doc.id}
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

                      return (
                        <td
                          key={key}
                          onContextMenu={(e) => handleContextMenu(e, key, doc.id, doc.name)}
                          style={{
                            width: colWidth ? `${colWidth}px` : undefined,
                            backgroundColor: colBg && !rowBg ? colBg : undefined,
                          }}
                          className={cn(
                            "border-r border-border px-3 py-3 last:border-r-0 overflow-hidden",
                            col.className
                          )}
                        >
                          {renderCellContent(key, row)}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-right overflow-hidden">
                      <div className="flex items-center justify-end gap-1">
                        {doc.type === "resume" && !doc.is_default && (
                          <Tooltip>
                            <TooltipTrigger render={<span className="inline-flex" />}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 gap-1 px-2"
                                onClick={() => handleSetDefault(doc.id)}
                                disabled={pendingId === doc.id}
                              >
                                {pendingId === doc.id ? (
                                  <Spinner className="size-3" />
                                ) : (
                                  <Star className="size-3.5" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-[11px] font-medium py-1 px-2">
                              Set as default resume
                            </TooltipContent>
                          </Tooltip>
                        )}
                         {!doc.builder_data && (
                          <>
                            <Tooltip>
                              <TooltipTrigger render={<span className="inline-flex" />}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 gap-1"
                                  onClick={() => handleOpenFolder(doc.id, doc)}
                                  disabled={pendingId === doc.id}
                                >
                                  {pendingId === doc.id ? (
                                    <Spinner className="size-3" />
                                  ) : doc.generated_kind === "external_link" ? (
                                    <ExternalLinkIcon className="size-3.5" />
                                  ) : (
                                    <Folder className="size-3.5" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-[11px] font-medium py-1 px-2">
                                {doc.generated_kind === "external_link" ? "Open external link" : "Open local folder location"}
                              </TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger render={<span className="inline-flex" />}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 gap-1"
                                  onClick={() => handleDownload(doc)}
                                >
                                  <DownloadIcon className="size-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-[11px] font-medium py-1 px-2">
                                DownloadIcon document
                              </TooltipContent>
                            </Tooltip>
                          </>
                        )}
                        <Tooltip>
                          <TooltipTrigger render={<span className="inline-flex" />}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1 text-destructive hover:text-destructive"
                              onClick={() => handleDelete(doc.id, doc.name)}
                              disabled={pendingId === doc.id}
                            >
                              {pendingId === doc.id ? (
                                <Spinner className="size-3" />
                              ) : (
                                <Trash2 className="size-3.5" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-[11px] font-medium py-1 px-2">
                            Delete document
                          </TooltipContent>
                        </Tooltip>
                      </div>
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
              {contextMenu.docId && (
                <div className="mb-2 pb-2 border-b border-border space-y-1.5">
                  <div className="text-xs font-semibold text-foreground truncate">
                    Row: {contextMenu.docName || "Document"}
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
                            setRowColor(contextMenu.docId!, p.value);
                            setContextMenu(null);
                          }}
                          style={{ backgroundColor: p.value }}
                          title={p.name}
                          className={cn(
                            "size-5 rounded-full border border-border/80 transition-transform hover:scale-110 flex items-center justify-center",
                            rowColors[contextMenu.docId!] === p.value && "ring-2 ring-primary ring-offset-1"
                          )}
                        >
                          {rowColors[contextMenu.docId!] === p.value && (
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
                            setRowColor(contextMenu.docId!, e.target.value);
                            setContextMenu(null);
                          }}
                        />
                        <Palette className="size-3 text-white drop-shadow" />
                      </label>
                      {rowColors[contextMenu.docId!] && (
                        <button
                          onClick={() => {
                            setRowColor(contextMenu.docId!, "");
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
            No documents match your search or filter criteria.
          </p>
        </div>
      )}
      {dialog}
    </div>
  );
}
