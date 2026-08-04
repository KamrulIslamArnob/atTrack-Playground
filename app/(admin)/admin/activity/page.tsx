"use client";

import { useState, useEffect, useCallback } from "react";
import { getAdminActivityLog } from "@/lib/actions/admin";
import type { AdminActivityLogEntry } from "@/lib/actions/admin";
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
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const ACTION_COLORS: Record<string, string> = {
  create: "bg-green-100 text-green-700",
  delete: "bg-red-100 text-red-700",
  update: "bg-blue-100 text-blue-700",
  send: "bg-purple-100 text-purple-700",
  upload: "bg-orange-100 text-orange-700",
  extract: "bg-cyan-100 text-cyan-700",
  sign_in: "bg-indigo-100 text-indigo-700",
  sign_up: "bg-emerald-100 text-emerald-700",
  sign_out: "bg-gray-100 text-gray-700",
};

export default function AdminActivityPage() {
  const [logs, setLogs] = useState<AdminActivityLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [resourceFilter, setResourceFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [userIdFilter, setUserIdFilter] = useState("");
  const limit = 30;

  const loadLogs = useCallback(async () => {
    setLoading(true);
    const filter: Record<string, string> = {};
    if (actionFilter && actionFilter !== "all") filter.action = actionFilter;
    if (resourceFilter && resourceFilter !== "all") filter.resource = resourceFilter;
    if (userIdFilter) filter.user_id = userIdFilter;

    const result = await getAdminActivityLog(page, limit, filter as Parameters<typeof getAdminActivityLog>[2]);
    setLogs(result.logs);
    setTotal(result.total);
    setLoading(false);
  }, [page, actionFilter, resourceFilter, userIdFilter]);

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
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Activity Log</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {total.toLocaleString()} total entries
        </p>
      </div>

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
          <SelectTrigger className="w-full sm:w-[140px] text-sm">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="create">Create</SelectItem>
            <SelectItem value="update">Update</SelectItem>
            <SelectItem value="delete">Delete</SelectItem>
            <SelectItem value="send">Send</SelectItem>
            <SelectItem value="upload">Upload</SelectItem>
            <SelectItem value="extract">Extract</SelectItem>
            <SelectItem value="sign_in">Sign In</SelectItem>
            <SelectItem value="sign_up">Sign Up</SelectItem>
            <SelectItem value="sign_out">Sign Out</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={resourceFilter}
          onValueChange={(v) => { setResourceFilter(v ?? "all"); setPage(1); }}
        >
          <SelectTrigger className="w-full sm:w-[140px] text-sm">
            <SelectValue placeholder="Resource" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Resources</SelectItem>
            <SelectItem value="auth">Auth</SelectItem>
            <SelectItem value="job">Job</SelectItem>
            <SelectItem value="application">Application</SelectItem>
            <SelectItem value="interview">Interview</SelectItem>
            <SelectItem value="document">Document</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="mcq_result">MCQ</SelectItem>
            <SelectItem value="screenshot">Screenshot</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No activity found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">User</TableHead>
                  <TableHead className="text-xs">Action</TableHead>
                  <TableHead className="text-xs hidden sm:table-cell">Resource</TableHead>
                  <TableHead className="text-xs hidden md:table-cell">Metadata</TableHead>
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
                      <Badge
                        variant="secondary"
                        className={`text-[10px] ${ACTION_COLORS[log.action] ?? ""}`}
                      >
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className="text-xs text-muted-foreground">{log.resource}</span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell max-w-[200px] truncate">
                      <span className="text-xs text-muted-foreground">
                        {JSON.stringify(log.metadata).slice(0, 60)}
                      </span>
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
