"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";

interface DateFieldProps {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 71 }, (_, i) => currentYear + 10 - i);

export function DateField({ value, onChange, ariaLabel }: DateFieldProps) {
  const [isActive, setIsActive] = useState(false);
  const [isCustom, setIsCustom] = useState(false);

  // Parse existing value
  const parseDate = useCallback((val: string) => {
    const present = val.toLowerCase().includes("present");
    const parts = val.replace(/present/gi, "").trim().split(/[–—\-−]+/).map(p => p.trim());
    
    let startMonth = "";
    let startYear = "";
    let endMonth = "";
    let endYear = "";

    const parsePart = (part: string) => {
      const monthMatch = part.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i);
      const yearMatch = part.match(/\b(19|20)\d{2}\b/);
      return {
        month: monthMatch ? monthMatch[0] : "",
        year: yearMatch ? yearMatch[0] : "",
      };
    };

    if (parts[0]) {
      const p = parsePart(parts[0]);
      startMonth = p.month;
      startYear = p.year;
    }
    if (parts[1]) {
      const p = parsePart(parts[1]);
      endMonth = p.month;
      endYear = p.year;
    }

    return { startMonth, startYear, endMonth, endYear, present };
  }, []);

  const { startMonth, startYear, endMonth, endYear, present } = parseDate(value);

  const formatOutput = useCallback(
    (sm: string, sy: string, em: string, ey: string, isPresent: boolean) => {
      const start = [sm, sy].filter(Boolean).join(" ");
      if (isPresent) return `${start} – Present`;
      const end = [em, ey].filter(Boolean).join(" ");
      if (start && end) return `${start} – ${end}`;
      return start || end || "";
    },
    []
  );

  const handleCommit = useCallback(
    (sm: string, sy: string, em: string, ey: string, isPresent: boolean) => {
      onChange(formatOutput(sm, sy, em, ey, isPresent));
    },
    [onChange, formatOutput]
  );

  if (isCustom) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          aria-label={`Edit ${ariaLabel}`}
          className={cn(
            "flex-1 rounded-md border border-ring bg-background px-2 py-1 text-sm h-9",
            "ring-2 ring-ring ring-offset-2 ring-offset-background focus:outline-none"
          )}
          defaultValue={value}
          onBlur={(e) => {
            onChange(e.target.value);
            setIsActive(false);
            setIsCustom(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onChange((e.target as HTMLInputElement).value);
              setIsActive(false);
              setIsCustom(false);
            }
          }}
          autoFocus
        />
        <button
          type="button"
          onClick={() => setIsCustom(false)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Presets
        </button>
      </div>
    );
  }

  if (!isActive) {
    return (
      <span
        role="button"
        tabIndex={0}
        aria-label={`${ariaLabel}: ${value || "empty"}. Click to edit.`}
        className={cn(
          "cursor-text rounded px-1 -mx-1 text-sm",
          !value && "italic text-muted-foreground/60",
          value && "hover:bg-muted/40",
          "focus:outline-none focus:ring-2 focus:ring-ring"
        )}
        onClick={() => setIsActive(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsActive(true);
          }
        }}
      >
        {value || "Click to add date…"}
      </span>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-ring bg-background p-3 ring-2 ring-ring ring-offset-2 ring-offset-background">
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">From:</span>
        <select
          aria-label="Start month"
          value={startMonth}
          onChange={(e) => handleCommit(e.target.value, startYear, endMonth, endYear, present)}
          className="h-7 rounded border border-input bg-background px-1 text-xs"
        >
          <option value="">Month</option>
          {MONTHS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <select
          aria-label="Start year"
          value={startYear}
          onChange={(e) => handleCommit(startMonth, e.target.value, endMonth, endYear, present)}
          className="h-7 rounded border border-input bg-background px-1 text-xs"
        >
          <option value="">Year</option>
          {YEARS.map((y) => (
            <option key={y} value={String(y)}>{y}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">To:</span>
        <select
          aria-label="End month"
          value={present ? "" : endMonth}
          disabled={present}
          onChange={(e) => handleCommit(startMonth, startYear, e.target.value, endYear, present)}
          className="h-7 rounded border border-input bg-background px-1 text-xs disabled:opacity-40"
        >
          <option value="">Month</option>
          {MONTHS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <select
          aria-label="End year"
          value={present ? "" : endYear}
          disabled={present}
          onChange={(e) => handleCommit(startMonth, startYear, endMonth, e.target.value, present)}
          className="h-7 rounded border border-input bg-background px-1 text-xs disabled:opacity-40"
        >
          <option value="">Year</option>
          {YEARS.map((y) => (
            <option key={y} value={String(y)}>{y}</option>
          ))}
        </select>
        <label className="inline-flex items-center gap-1 ml-2">
          <input
            type="checkbox"
            checked={present}
            onChange={(e) => handleCommit(startMonth, startYear, endMonth, endYear, e.target.checked)}
            className="size-3"
          />
          <span className="text-xs">Present</span>
        </label>
      </div>
      <div className="flex items-center gap-2 pt-1 border-t border-border">
        <button
          type="button"
          onClick={() => setIsCustom(true)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Custom
        </button>
        <button
          type="button"
          onClick={() => setIsActive(false)}
          className="text-xs text-primary hover:text-primary/80"
        >
          Done
        </button>
      </div>
    </div>
  );
}
