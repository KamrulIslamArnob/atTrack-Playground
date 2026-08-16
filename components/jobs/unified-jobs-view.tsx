"use client";

import { useEffect, useState } from "react";
import { BoardView } from "@/components/board/board-view";
import { JobViewHeader } from "@/components/board/board-view-header";
import { JobsToolbar } from "@/components/jobs-toolbar";
import { JobsGrid } from "@/components/jobs-grid";
import type { BoardCard, BoardList } from "@/lib/types/board";
import type { JobsListResult } from "@/lib/actions/jobs-list";

interface UnifiedJobsViewProps {
  initialView?: "board" | "list";
  boardLists: BoardList[];
  boardCards: BoardCard[];
  jobsListResult: JobsListResult;
  initialSearch?: string;
  initialStatus?: string;
}

const STORAGE_KEY = "attrack-jobs-view";

export function UnifiedJobsView({
  initialView = "board",
  boardLists,
  boardCards,
  jobsListResult,
  initialSearch = "",
  initialStatus = "all",
}: UnifiedJobsViewProps) {
  const [view, setView] = useState<"board" | "list">(initialView);

  // Sync with localStorage on client mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "list" || saved === "board") {
        setView(saved);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const handleViewChange = (newView: "board" | "list") => {
    setView(newView);
    try {
      localStorage.setItem(STORAGE_KEY, newView);
    } catch {
      // Ignore localStorage errors
    }
  };

  if (view === "board") {
    return (
      <BoardView
        lists={boardLists}
        cards={boardCards}
        onViewChange={handleViewChange}
      />
    );
  }

  return (
    <div className="space-y-4">
      <JobViewHeader currentView="list" onViewChange={handleViewChange}>
        <JobsToolbar
          initialSearch={initialSearch}
          initialStatus={initialStatus}
          page={jobsListResult.page}
          totalPages={jobsListResult.totalPages}
          perPage={jobsListResult.perPage}
        />
      </JobViewHeader>

      <JobsGrid
        jobs={jobsListResult.jobs}
        total={jobsListResult.total}
        initialSearch={initialSearch}
        initialStatus={initialStatus}
        page={jobsListResult.page}
        totalPages={jobsListResult.totalPages}
        perPage={jobsListResult.perPage}
      />
    </div>
  );
}
