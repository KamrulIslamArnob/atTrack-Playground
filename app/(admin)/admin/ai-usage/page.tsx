"use client";

import { useState, useEffect, useCallback } from "react";
import { getAdminAiUsage } from "@/lib/actions/admin";
import type { AdminAiUsageEntry } from "@/lib/actions/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Coins,
  Zap,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function AdminAiUsagePage() {
  const [logs, setLogs] = useState<AdminAiUsageEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [totalTokens, setTotalTokens] = useState(0);
  const [totalCost, setTotalCost] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [userIdFilter, setUserIdFilter] = useState("");
  const [search, setSearch] = useState("");
  const limit = 30;

  const loadLogs = useCallback(async () => {
    setLoading(true);
    const filter: Record<string, string> = {};
    if (actionFilter && actionFilter !== "all") filter.action = actionFilter;
    if (userIdFilter) filter.user_id = userIdFilter;

    const result = await getAdminAiUsage(page, limit, filter as Parameters<typeof getAdminAiUsage>[2]);
    setLogs(result.logs);
    setTotal(result.total);
    setTotalTokens(result.totalTokens);
    setTotalCost(result.totalCost);
    setLoading(false);
  }, [page, actionFilter, userIdFilter]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  function handleSearch() {
    const match = logs.find((l) => l.user_email === search);
    if (match) {
      setUserIdFilter(match.user_id);
      setPage(1);
    } else {
      setUserIdFilter("");
      setPage(1);
    }
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">AI Usage</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {total.toLocaleString()} total requests across all users.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Requests</p>
                <p className="text-xl sm:text-2xl font-bold">{total.toLocaleString()}</p>
              </div>
              <Zap className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Tokens</p>
                <p className="text-xl sm:text-2xl font-bold">{totalTokens.toLocaleString()}</p>
              </div>
              <Cpu className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Estimated Cost</p>
                <p className="text-xl sm:text-2xl font-bold">${totalCost.toFixed(4)}</p>
              </div>
              <Coins className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter by email..."
            className="pl-8 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
        </div>
        <Select
          value={actionFilter}
          onValueChange={(v) => { setActionFilter(v ?? "all"); setPage(1); }}
        >
          <SelectTrigger className="w-full sm:w-[160px] text-sm">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="interview_prep">Interview Prep</SelectItem>
            <SelectItem value="mcq_generation">MCQ Generation</SelectItem>
            <SelectItem value="cv_improvement">CV Improvement</SelectItem>
            <SelectItem value="job_extraction">Job Extraction</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No AI usage found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">User</TableHead>
                  <TableHead className="text-xs">Action</TableHead>
                  <TableHead className="text-xs hidden sm:table-cell">Model</TableHead>
                  <TableHead className="text-xs hidden sm:table-cell">Tokens</TableHead>
                  <TableHead className="text-xs hidden md:table-cell">Cost</TableHead>
                  <TableHead className="text-xs text-right">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div className="text-xs">
                        <div className="font-medium">{log.user_name}</div>
                        <div className="text-muted-foreground">{log.user_email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px]">
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className="text-xs text-muted-foreground">{log.model}</span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className="text-xs">
                        {log.input_tokens.toLocaleString()} → {log.output_tokens.toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="text-xs">${log.cost_usd.toFixed(4)}</span>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
