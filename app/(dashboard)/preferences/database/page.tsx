"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Database,
  Table2,
  ChevronRight,
  ChevronDown,
  Loader2,
  Search,
  Key,
  Link2,
  Lock,
  Pencil,
  Check,
  X,
  Hash,
  Type,
  ToggleLeft,
  AlertCircle,
  Layers,
  PanelLeft,
  PanelLeftClose,
  Menu,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types (mirror the API route)
// ---------------------------------------------------------------------------

interface ColumnInfo {
  name: string;
  type: string;
  notnull: boolean;
  pk: number;
}

interface ForeignKeyInfo {
  from: string;
  to_table: string;
  to_column: string;
  on_update: string;
  on_delete: string;
}

interface TableData {
  name: string;
  columns: ColumnInfo[];
  foreignKeys: ForeignKeyInfo[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

// ---------------------------------------------------------------------------
// Cell editor
// ---------------------------------------------------------------------------

interface EditingCell {
  rowIdx: number;
  colName: string;
  value: string;
}

function InlineEditor({
  value,
  type,
  onSave,
  onCancel,
}: {
  value: string;
  type: string;
  onSave: (v: string) => void;
  onCancel: () => void;
}) {
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const isBoolean = type.toUpperCase() === "INTEGER" && (value === "0" || value === "1");

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") onSave(editValue);
    if (e.key === "Escape") onCancel();
  };

  if (isBoolean) {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={() => onSave(editValue === "1" ? "0" : "1")}
          className="flex items-center gap-1 px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-xs font-mono"
        >
          <ToggleLeft className="size-3" />
          {editValue === "1" ? "1 (true)" : "0 (false)"}
        </button>
        <button onClick={onCancel} className="p-0.5 hover:text-destructive">
          <X className="size-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 min-w-[120px]">
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={onCancel}
        className="flex-1 px-1.5 py-0.5 text-xs font-mono border border-primary rounded bg-background outline-none"
      />
      <button onClick={() => onSave(editValue)} className="p-0.5 text-emerald-500 hover:text-emerald-600">
        <Check className="size-3" />
      </button>
      <button onClick={onCancel} className="p-0.5 text-destructive hover:text-destructive/80">
        <X className="size-3" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function DatabasePage() {
  const [tables, setTables] = useState<TableData[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [filterText, setFilterText] = useState("");
  const [editing, setEditing] = useState<EditingCell | null>(null);
  const [saving, setSaving] = useState(false);

  // --- responsive sidebar state -------------------------------------------
  const [showMobileTables, setShowMobileTables] = useState(false);
  const [showDesktopTables, setShowDesktopTables] = useState(true);

  // --- single fetch & auto-select first table ------------------------------
  useEffect(() => {
    let cancelled = false;
    async function fetchAll() {
      try {
        const res = await fetch("/api/database");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          setTables(data.tables);
          if (data.tables && data.tables.length > 0) {
            setSelectedTable(data.tables[0].name);
          }
        }
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load database");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchAll();
    return () => {
      cancelled = true;
    };
  }, []);

  // --- helpers ------------------------------------------------------------
  const toggleExpand = useCallback((name: string) => {
    setExpandedTables((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const selectTable = useCallback((name: string) => {
    setSelectedTable(name);
    setFilterText("");
    setEditing(null);
    setShowMobileTables(false);
  }, []);

  const activeTable = selectedTable
    ? (tables ?? []).find((t) => t.name === selectedTable) ?? null
    : null;

  // Determine PK column for the active table.
  const pkColumn = activeTable?.columns.find((c) => c.pk > 0)?.name ?? "rowid";

  // Cascading FK columns (read-only).
  const readOnlyCols = new Set<string>();
  if (activeTable) {
    for (const fk of activeTable.foreignKeys) {
      if (fk.on_update.toUpperCase() === "CASCADE") {
        readOnlyCols.add(fk.from);
      }
    }
  }

  // Filtered rows for the data grid.
  const filteredRows = activeTable
    ? filterText.trim()
      ? activeTable.rows.filter((row) =>
          Object.values(row).some(
            (v) =>
              v != null &&
              String(v).toLowerCase().includes(filterText.toLowerCase())
          )
        )
      : activeTable.rows
    : [];

  // Filtered tree tables based on search.
  const filteredTables = tables
    ? searchQuery.trim()
      ? tables.filter(
          (t) =>
            t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.columns.some((c) =>
              c.name.toLowerCase().includes(searchQuery.toLowerCase())
            )
        )
      : tables
    : [];

  // --- inline save --------------------------------------------------------
  const handleSaveCell = useCallback(
    async (rowIdx: number, colName: string, rawValue: string) => {
      if (!activeTable) return;
      const row = filteredRows[rowIdx];
      if (!row) return;

      const col = activeTable.columns.find((c) => c.name === colName);
      if (!col) return;

      // Parse value for the type.
      let parsedValue: unknown = rawValue;
      const upperType = col.type.toUpperCase();
      if (rawValue === "" && col.notnull === false) {
        parsedValue = null;
      } else if (upperType.includes("INT")) {
        const n = Number(rawValue);
        if (!Number.isNaN(n)) parsedValue = n;
      } else if (upperType === "REAL" || upperType === "FLOAT" || upperType === "DOUBLE") {
        const n = Number(rawValue);
        if (!Number.isNaN(n)) parsedValue = n;
      } else if (rawValue === "NULL" && !col.notnull) {
        parsedValue = null;
      }

      const pkVal = row[pkColumn];
      if (pkVal == null) {
        toast.error("Cannot update row without primary key");
        return;
      }

      setSaving(true);
      try {
        const res = await fetch("/api/database/update", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            table: activeTable.name,
            column: colName,
            pkColumn,
            pkValue: pkVal,
            value: parsedValue,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error ?? `Update failed (${res.status})`);
        }

        const { row: updated } = (await res.json()) as {
          row: Record<string, unknown> | undefined;
        };

        // Update the cached row in-place.
        setTables((prev) => {
          if (!prev) return prev;
          return prev.map((t) => {
            if (t.name !== activeTable.name) return t;
            const newRows = t.rows.map((r) => {
              if (r[pkColumn] === pkVal) return updated ?? r;
              return r;
            });
            return { ...t, rows: newRows };
          });
        });

        toast.success(`Updated ${colName}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Update failed");
      } finally {
        setSaving(false);
        setEditing(null);
      }
    },
    [activeTable, filteredRows, pkColumn]
  );

  // --- loading ------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  // --- error --------------------------------------------------------------
  if (error) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-3 p-4 text-destructive text-sm">
          <AlertCircle className="size-5 shrink-0" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  // Helper renderer for table tree list
  const renderTablesList = () => (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tree header */}
      <div className="p-3 border-b border-border flex items-center gap-2 shrink-0">
        <Database className="size-4 text-cyan-500" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Tables
        </span>
        <Badge variant="secondary" className="ml-auto text-[10px] h-5">
          {tables?.length ?? 0}
        </Badge>
      </div>

      {/* Search */}
      <div className="p-2 border-b border-border shrink-0">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Filter tables..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-7 h-7 text-xs bg-background"
          />
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {filteredTables.map((table) => {
          const isExpanded = expandedTables.has(table.name);
          const isActive = selectedTable === table.name;

          return (
            <div key={table.name}>
              {/* Table row */}
              <button
                onClick={() => {
                  toggleExpand(table.name);
                  selectTable(table.name);
                }}
                className={`w-full flex items-center gap-1.5 px-2.5 py-1.5 text-left text-xs transition-colors ${
                  isActive
                    ? "bg-primary/10 text-foreground font-medium"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }`}
              >
                <span className="shrink-0 size-3.5 flex items-center justify-center">
                  {isExpanded ? (
                    <ChevronDown className="size-3" />
                  ) : (
                    <ChevronRight className="size-3" />
                  )}
                </span>
                <Table2 className="size-3.5 shrink-0 text-cyan-500" />
                <span className="truncate font-mono">{table.name}</span>
                <span className="ml-auto text-[10px] text-muted-foreground/70 shrink-0">
                  {table.rowCount}
                </span>
              </button>

              {/* Columns (when expanded) */}
              {isExpanded && (
                <div className="ml-5 border-l border-border/50">
                  {table.columns.map((col) => {
                    const hasFK = table.foreignKeys.some(
                      (fk) => fk.from === col.name
                    );
                    return (
                      <div
                        key={col.name}
                        className="flex items-center gap-1.5 px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted/30"
                      >
                        {col.pk > 0 ? (
                          <Key className="size-3 shrink-0 text-amber-500" />
                        ) : hasFK ? (
                          <Link2 className="size-3 shrink-0 text-blue-400" />
                        ) : (
                          <span className="size-3 shrink-0 inline-flex items-center justify-center">
                            <span className="size-1.5 rounded-full bg-muted-foreground/40" />
                          </span>
                        )}
                        <span className="truncate font-mono">{col.name}</span>
                        <span className="ml-auto text-[9px] uppercase tracking-tight text-muted-foreground/60 shrink-0">
                          {col.type}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  // --- render -------------------------------------------------------------
  return (
    <div className="flex h-full w-full overflow-hidden bg-background relative">
      {/* ==================== MOBILE DRAWER OVERLAY ==================== */}
      {showMobileTables && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm md:hidden flex">
          <div className="relative w-80 max-w-[85vw] bg-card h-full border-r border-border flex flex-col shadow-2xl animate-in slide-in-from-left duration-200">
            <div className="p-2 border-b border-border flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-2">
                Database Tables
              </span>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setShowMobileTables(false)}
              >
                <X className="size-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-hidden">{renderTablesList()}</div>
          </div>
          <div
            className="flex-1"
            onClick={() => setShowMobileTables(false)}
          />
        </div>
      )}

      {/* ==================== LEFT: Desktop Tree ==================== */}
      {showDesktopTables && (
        <div className="hidden md:flex w-64 shrink-0 border-r border-border bg-muted/30 flex-col h-full overflow-hidden transition-all duration-200">
          {renderTablesList()}
        </div>
      )}

      {/* ==================== RIGHT: data grid ==================== */}
      <div className="flex-1 flex flex-col h-full w-full overflow-hidden min-w-0">
        {!activeTable ? (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center p-4">
            <div className="md:hidden mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMobileTables(true)}
                className="gap-2 text-xs"
              >
                <PanelLeft className="size-4" />
                Select Table ({tables?.length ?? 0})
              </Button>
            </div>
            <div className="text-center space-y-3">
              <Layers className="size-12 mx-auto text-muted-foreground/30" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Select a table to view its data
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Click any table in the left panel to browse rows and edit cells
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Grid toolbar */}
            <div className="p-2.5 sm:p-3 border-b border-border flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 bg-background shrink-0">
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                {/* Mobile Drawer Trigger */}
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => setShowMobileTables(true)}
                  className="md:hidden flex items-center gap-1.5"
                >
                  <PanelLeft className="size-3.5" />
                  <span className="text-xs">Tables</span>
                </Button>

                {/* Desktop Sidebar Toggle */}
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setShowDesktopTables((v) => !v)}
                  className="hidden md:flex text-muted-foreground hover:text-foreground shrink-0"
                  title={showDesktopTables ? "Collapse table panel" : "Expand table panel"}
                >
                  {showDesktopTables ? (
                    <PanelLeftClose className="size-4" />
                  ) : (
                    <PanelLeft className="size-4" />
                  )}
                </Button>

                <Table2 className="size-4 shrink-0 text-cyan-500" />
                <span className="font-mono font-semibold text-sm truncate max-w-[150px] sm:max-w-[250px]">
                  {activeTable.name}
                </span>
                <Badge variant="secondary" className="text-[10px] h-5 shrink-0">
                  {activeTable.rowCount} rows
                </Badge>
                <Badge variant="outline" className="text-[10px] h-5 shrink-0 hidden sm:inline-flex">
                  {activeTable.columns.length} cols
                </Badge>
              </div>

              <div className="w-full sm:w-56 shrink-0 relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  placeholder="Filter rows..."
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  className="pl-7 h-7 text-xs w-full"
                />
              </div>
            </div>

            {/* Column legend */}
            <div className="px-3 py-1.5 border-b border-border flex items-center gap-2 bg-muted/20 text-[10px] text-muted-foreground overflow-x-auto whitespace-nowrap shrink-0">
              <Key className="size-3 text-amber-500 shrink-0" /> Primary key (read-only)
              <span className="mx-1">·</span>
              <Link2 className="size-3 text-blue-400 shrink-0" /> Foreign key
              {readOnlyCols.size > 0 && (
                <>
                  <span className="mx-1">·</span>
                  <Lock className="size-3 text-orange-400 shrink-0" /> Cascading FK (read-only)
                </>
              )}
            </div>

            {/* The grid — fluid width with smart horizontal/vertical overflow scroll */}
            <div className="flex-1 overflow-x-auto overflow-y-auto w-full h-full min-w-0">
              {filteredRows.length === 0 ? (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground p-4">
                  {filterText ? "No matching rows." : "Table is empty."}
                </div>
              ) : (
                <table className="w-full min-w-full text-xs border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-muted/80 backdrop-blur-xs">
                      <th className="px-2 py-2 text-left font-medium text-muted-foreground border-b border-r border-border w-10 shrink-0">
                        <Hash className="size-3" />
                      </th>
                      {activeTable.columns.map((col) => {
                        const isReadOnly =
                          col.pk > 0 || readOnlyCols.has(col.name);
                        return (
                          <th
                            key={col.name}
                            className="px-3 py-2 text-left font-mono font-medium text-foreground border-b border-r border-border whitespace-nowrap"
                          >
                            <span className="flex items-center gap-1.5">
                              {col.pk > 0 && (
                                <Key className="size-3 text-amber-500" />
                              )}
                              {readOnlyCols.has(col.name) && !col.pk && (
                                <Lock className="size-3 text-orange-400" />
                              )}
                              {activeTable.foreignKeys.some(
                                (fk) => fk.from === col.name
                              ) &&
                                !col.pk &&
                                !readOnlyCols.has(col.name) && (
                                  <Link2 className="size-3 text-blue-400" />
                                )}
                              <span className="truncate max-w-[200px]">
                                {col.name}
                              </span>
                              <span className="text-[10px] text-muted-foreground font-sans font-normal uppercase">
                                {col.type}
                              </span>
                              {col.notnull && !col.pk && (
                                <span className="text-[9px] text-muted-foreground font-sans font-normal">
                                  NOT NULL
                                </span>
                              )}
                            </span>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row, rowIdx) => {
                      return (
                        <tr
                          key={rowIdx}
                          className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                        >
                          <td className="px-2 py-1.5 text-center text-muted-foreground/60 font-mono border-r border-border bg-muted/10">
                            {rowIdx + 1}
                          </td>
                          {activeTable.columns.map((col) => {
                            const val = row[col.name];
                            const isReadOnly =
                              col.pk > 0 || readOnlyCols.has(col.name);
                            const display =
                              val === null
                                ? "NULL"
                                : typeof val === "object"
                                  ? JSON.stringify(val)
                                  : String(val);

                            const isEditing =
                              editing?.rowIdx === rowIdx &&
                              editing?.colName === col.name;

                            if (isEditing) {
                              return (
                                <td
                                  key={col.name}
                                  className="px-1 py-0.5 border-r border-border min-w-[140px]"
                                >
                                  <InlineEditor
                                    value={editing!.value}
                                    type={col.type}
                                    onSave={(v) =>
                                      handleSaveCell(rowIdx, col.name, v)
                                    }
                                    onCancel={() => setEditing(null)}
                                  />
                                </td>
                              );
                            }

                            return (
                              <td
                                key={col.name}
                                className={`px-3 py-1.5 border-r border-border font-mono ${
                                  isReadOnly
                                    ? "cursor-default"
                                    : "cursor-pointer hover:bg-primary/5 group/cell relative"
                                } ${
                                  val === null
                                    ? "text-muted-foreground italic"
                                    : "text-foreground"
                                }`}
                                onClick={() => {
                                  if (isReadOnly || saving) return;
                                  setEditing({
                                    rowIdx,
                                    colName: col.name,
                                    value: display === "NULL" ? "" : display,
                                  });
                                }}
                                title={
                                  isReadOnly
                                    ? `${col.name} (read-only)`
                                    : `Click to edit ${col.name}`
                                }
                              >
                                <span className="flex items-center gap-1 justify-between">
                                  <span className="truncate max-w-[280px]">
                                    {display.length > 100
                                      ? display.slice(0, 100) + "…"
                                      : display}
                                  </span>
                                  {!isReadOnly && (
                                    <Pencil className="size-3 shrink-0 opacity-0 group-hover/cell:opacity-100 text-muted-foreground" />
                                  )}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer */}
            <div className="px-3 py-1.5 border-t border-border text-[10px] text-muted-foreground flex flex-wrap items-center justify-between gap-2 bg-muted/20 shrink-0">
              <span>
                Showing {filteredRows.length} of {activeTable.rowCount} rows
              </span>
              {readOnlyCols.size > 0 && (
                <span className="flex items-center gap-1">
                  <Lock className="size-3 text-orange-400" />
                  {readOnlyCols.size} cascading FK column{readOnlyCols.size > 1 ? "s" : ""} locked
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
