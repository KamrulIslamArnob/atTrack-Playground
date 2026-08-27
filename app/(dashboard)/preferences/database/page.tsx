"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Database,
  Table2,
  Loader2,
  Pencil,
  Hash,
  AlertCircle,
  PanelLeft,
  PanelLeftClose,
} from "lucide-react";
import { ChevronRightIcon } from "@/components/ui/chevron-right";
import { ChevronDownIcon } from "@/components/ui/chevron-down";
import { SearchIcon } from "@/components/ui/search";
import { KeyIcon } from "@/components/ui/key";
import { Link2Icon } from "@/components/ui/link-2";
import { LockIcon } from "@/components/ui/lock";
import { CheckIcon } from "@/components/ui/check";
import { XIcon } from "@/components/ui/x";
import { LayersIcon } from "@/components/ui/layers";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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

  if (isBoolean) {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={() => onSave(editValue === "1" ? "0" : "1")}
          className="rounded-md bg-muted px-2 py-1 text-xs font-mono hover:bg-muted/80"
        >
          {editValue === "1" ? "true" : "false"}
        </button>
        <button onClick={onCancel} className="p-1 text-muted-foreground hover:text-foreground">
          <XIcon className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSave(editValue);
          if (e.key === "Escape") onCancel();
        }}
        onBlur={onCancel}
        className="flex-1 rounded-md border border-primary bg-background px-2 py-1 text-xs font-mono outline-none"
      />
      <button onClick={() => onSave(editValue)} className="p-1 text-success hover:text-success/80">
        <CheckIcon className="size-3.5" />
      </button>
      <button onClick={onCancel} className="p-1 text-muted-foreground hover:text-foreground">
        <XIcon className="size-3.5" />
      </button>
    </div>
  );
}

export default function DatabasePage() {
  const router = useRouter();
  const [tables, setTables] = useState<TableData[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [disabled, setDisabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [filterText, setFilterText] = useState("");
  const [editing, setEditing] = useState<EditingCell | null>(null);
  const [saving, setSaving] = useState(false);

  const [showMobileTables, setShowMobileTables] = useState(false);
  const [showDesktopTables, setShowDesktopTables] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchAll() {
      try {
        const res = await fetch("/api/database");
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          if (res.status === 403 && !cancelled) setDisabled(true);
          throw new Error(errData.error ?? `HTTP ${res.status}`);
        }
        const data = await res.json();
        if (!cancelled) {
          setTables(data.tables);
          if (data.tables?.length) setSelectedTable(data.tables[0].name);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load the database");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchAll();
    return () => {
      cancelled = true;
    };
  }, []);

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

  const activeTable = selectedTable ? (tables ?? []).find((t) => t.name === selectedTable) ?? null : null;
  const pkColumn = activeTable?.columns.find((c) => c.pk > 0)?.name ?? "rowid";

  const readOnlyCols = new Set<string>();
  if (activeTable) {
    for (const fk of activeTable.foreignKeys) {
      if (fk.on_update.toUpperCase() === "CASCADE") readOnlyCols.add(fk.from);
    }
  }

  const filteredRows = activeTable
    ? filterText.trim()
      ? activeTable.rows.filter((row) =>
          Object.values(row).some((v) => v != null && String(v).toLowerCase().includes(filterText.toLowerCase()))
        )
      : activeTable.rows
    : [];

  const filteredTables = tables
    ? searchQuery.trim()
      ? tables.filter(
          (t) =>
            t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.columns.some((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
        )
      : tables
    : [];

  const handleSaveCell = useCallback(
    async (rowIdx: number, colName: string, rawValue: string) => {
      if (!activeTable) return;
      const row = filteredRows[rowIdx];
      if (!row) return;
      const col = activeTable.columns.find((c) => c.name === colName);
      if (!col) return;

      let parsedValue: unknown = rawValue;
      const upperType = col.type.toUpperCase();
      if (rawValue === "" && col.notnull === false) parsedValue = null;
      else if (upperType.includes("INT")) {
        const n = Number(rawValue);
        if (!Number.isNaN(n)) parsedValue = n;
      } else if (upperType === "REAL" || upperType === "FLOAT" || upperType === "DOUBLE") {
        const n = Number(rawValue);
        if (!Number.isNaN(n)) parsedValue = n;
      } else if (rawValue === "NULL" && !col.notnull) parsedValue = null;

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
          body: JSON.stringify({ table: activeTable.name, column: colName, pkColumn, pkValue: pkVal, value: parsedValue }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error ?? `Update failed (${res.status})`);
        }
        const { row: updated } = (await res.json()) as { row: Record<string, unknown> | undefined };
        setTables((prev) => {
          if (!prev) return prev;
          return prev.map((t) => {
            if (t.name !== activeTable.name) return t;
            return { ...t, rows: t.rows.map((r) => (r[pkColumn] === pkVal ? (updated ?? r) : r)) };
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

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (disabled) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8">
        <div className="max-w-sm space-y-3 text-center">
          <Database className="mx-auto size-8 text-muted-foreground/40" />
          <div>
            <p className="text-sm font-medium">Database viewer is off</p>
            <p className="mt-1 text-sm text-muted-foreground">
              This shows every table in your local database. Turn it on in Settings if that&apos;s you.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => router.push("/settings")}>
            Open settings
          </Button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm text-destructive">
        <AlertCircle className="size-4 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  const renderTablesList = () => (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Database className="size-4 text-muted-foreground" />
        <span className="text-xs font-medium">Tables</span>
        <Badge variant="secondary" className="ml-auto text-xs">
          {tables?.length ?? 0}
        </Badge>
      </div>

      <div className="border-b border-border p-2">
        <div className="relative">
          <SearchIcon className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Filter tables..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="h-8 pl-8 text-sm" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {filteredTables.map((table) => {
          const isExpanded = expandedTables.has(table.name);
          const isActive = selectedTable === table.name;
          return (
            <div key={table.name}>
              <button
                onClick={() => {
                  toggleExpand(table.name);
                  selectTable(table.name);
                }}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors ${
                  isActive ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {isExpanded ? <ChevronDownIcon className="size-3 shrink-0" /> : <ChevronRightIcon className="size-3 shrink-0" />}
                <Table2 className="size-3.5 shrink-0" />
                <span className="truncate font-mono text-xs">{table.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">{table.rowCount}</span>
              </button>

              {isExpanded && (
                <div className="ml-6 border-l border-border pl-2">
                  {table.columns.map((col) => {
                    const hasFK = table.foreignKeys.some((fk) => fk.from === col.name);
                    return (
                      <div key={col.name} className="flex items-center gap-1.5 py-1 text-xs text-muted-foreground">
                        {col.pk > 0 ? (
                          <KeyIcon className="size-3 text-muted-foreground" />
                        ) : hasFK ? (
                          <Link2Icon className="size-3 text-muted-foreground" />
                        ) : (
                          <span className="size-3" />
                        )}
                        <span className="truncate font-mono">{col.name}</span>
                        <span className="ml-auto text-xs text-muted-foreground">{col.type}</span>
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

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      {showMobileTables && (
        <div className="fixed inset-0 z-50 flex bg-background/80 backdrop-blur-sm md:hidden">
          <div className="flex h-full w-80 max-w-[85vw] flex-col border-r border-border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <span className="text-xs font-medium">Tables</span>
              <Button variant="ghost" size="icon-sm" onClick={() => setShowMobileTables(false)}>
                <XIcon className="size-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-hidden">{renderTablesList()}</div>
          </div>
          <div className="flex-1" onClick={() => setShowMobileTables(false)} />
        </div>
      )}

      {showDesktopTables && (
        <div className="hidden w-64 shrink-0 flex-col border-r border-border bg-card md:flex">{renderTablesList()}</div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {!activeTable ? (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
            <div className="md:hidden mb-4">
              <Button variant="outline" size="sm" onClick={() => setShowMobileTables(true)} className="gap-1.5">
                <PanelLeft className="size-4" /> Select table
              </Button>
            </div>
            <LayersIcon className="mx-auto size-10 text-muted-foreground/30" />
            <p className="mt-3 text-sm font-medium text-muted-foreground">Select a table to view its data</p>
            <p className="mt-1 text-sm text-muted-foreground">Choose a table from the left to browse rows.</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setShowDesktopTables((v) => !v)}
                  className="hidden md:flex"
                  aria-label={showDesktopTables ? "Collapse panel" : "Expand panel"}
                >
                  {showDesktopTables ? <PanelLeftClose className="size-4" /> : <PanelLeft className="size-4" />}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowMobileTables(true)} className="gap-1.5 md:hidden">
                  <PanelLeft className="size-4" />
                  Tables
                </Button>
                <Table2 className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate font-mono text-sm font-medium">{activeTable.name}</span>
                <Badge variant="secondary" className="text-xs">
                  {activeTable.rowCount} rows
                </Badge>
              </div>
              <div className="relative w-full sm:w-56">
                <SearchIcon className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Filter rows..." value={filterText} onChange={(e) => setFilterText(e.target.value)} className="h-8 pl-8 text-sm" />
              </div>
            </div>

            <div className="flex items-center gap-2 border-b border-border bg-muted px-3 py-1 text-xs text-muted-foreground">
              <KeyIcon className="size-3.5" /> Primary key
              <span className="text-border">·</span>
              <Link2Icon className="size-3.5" /> Foreign key
              {readOnlyCols.size > 0 && (
                <>
                  <span className="text-border">·</span>
                  <LockIcon className="size-3.5" /> Read-only
                </>
              )}
            </div>

            <div className="flex-1 overflow-auto">
              {filteredRows.length === 0 ? (
                <div className="flex h-full items-center justify-center p-8 text-sm text-muted-foreground">
                  {filterText ? "No matching rows." : "Table is empty."}
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-muted">
                    <tr>
                      <th className="w-10 border-b border-r border-border px-2 py-2 text-left">
                        <Hash className="size-3.5 text-muted-foreground" />
                      </th>
                      {activeTable.columns.map((col) => {
                        const isReadOnly = col.pk > 0 || readOnlyCols.has(col.name);
                        return (
                          <th key={col.name} className="whitespace-nowrap border-b border-r border-border px-3 py-2 text-left font-mono text-xs">
                            <span className="flex items-center gap-1.5">
                              {col.pk > 0 ? (
                                <KeyIcon className="size-3" />
                              ) : readOnlyCols.has(col.name) ? (
                                <LockIcon className="size-3" />
                              ) : activeTable.foreignKeys.some((fk) => fk.from === col.name) ? (
                                <Link2Icon className="size-3" />
                              ) : null}
                              {col.name}
                              <span className="font-normal text-muted-foreground">{col.type}</span>
                            </span>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row, rowIdx) => (
                      <tr key={rowIdx} className="border-b border-border/50 hover:bg-muted/50">
                        <td className="border-r border-border bg-muted/20 px-2 py-1.5 text-center font-mono text-xs text-muted-foreground">
                          {rowIdx + 1}
                        </td>
                        {activeTable.columns.map((col) => {
                          const val = row[col.name];
                          const isReadOnly = col.pk > 0 || readOnlyCols.has(col.name);
                          const display = val === null ? "NULL" : typeof val === "object" ? JSON.stringify(val) : String(val);
                          const isEditing = editing?.rowIdx === rowIdx && editing?.colName === col.name;
                          if (isEditing) {
                            return (
                              <td key={col.name} className="border-r border-border px-1 py-1">
                                <InlineEditor value={editing!.value} type={col.type} onSave={(v) => handleSaveCell(rowIdx, col.name, v)} onCancel={() => setEditing(null)} />
                              </td>
                            );
                          }
                          return (
                            <td
                              key={col.name}
                              className={`border-r border-border px-3 py-1.5 font-mono text-xs ${isReadOnly ? "" : "cursor-pointer hover:bg-primary/5"} ${val === null ? "italic text-muted-foreground" : ""}`}
                              onClick={() => {
                                if (isReadOnly || saving) return;
                                setEditing({ rowIdx, colName: col.name, value: display === "NULL" ? "" : display });
                              }}
                              title={isReadOnly ? "Read-only" : `Edit ${col.name}`}
                            >
                              <span className="flex items-center justify-between gap-1">
                                <span className="truncate max-w-[280px]">{display.length > 80 ? `${display.slice(0, 80)}…` : display}</span>
                                {!isReadOnly && <Pencil className="size-3 shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground" />}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-border bg-muted px-3 py-1 text-xs text-muted-foreground">
              <span>
                Showing {filteredRows.length} of {activeTable.rowCount} rows
              </span>
              {readOnlyCols.size > 0 && <span>{readOnlyCols.size} locked column{readOnlyCols.size > 1 ? "s" : ""}</span>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
