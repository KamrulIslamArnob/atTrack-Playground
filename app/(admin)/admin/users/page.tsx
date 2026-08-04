"use client";

import { useState, useEffect } from "react";
import { getAdminUsers, banUser, unbanUser, promoteToAdmin, demoteToUser } from "@/lib/actions/admin";
import type { AdminUser } from "@/lib/actions/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  Ban,
  ShieldCheck,
  UserMinus,
  UserPlus,
  Loader2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    const data = await getAdminUsers();
    setUsers(data);
    setLoading(false);
  }

  async function handleBan(userId: string) {
    setActionLoading(userId);
    const result = await banUser(userId);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("User banned");
      await loadUsers();
    }
    setActionLoading(null);
  }

  async function handleUnban(userId: string) {
    setActionLoading(userId);
    const result = await unbanUser(userId);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("User unbanned");
      await loadUsers();
    }
    setActionLoading(null);
  }

  async function handlePromote(userId: string) {
    setActionLoading(userId);
    const result = await promoteToAdmin(userId);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("User promoted to admin");
      await loadUsers();
    }
    setActionLoading(null);
  }

  async function handleDemote(userId: string) {
    setActionLoading(userId);
    const result = await demoteToUser(userId);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("User demoted to user");
      await loadUsers();
    }
    setActionLoading(null);
  }

  const filtered = users.filter(
    (u) =>
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.full_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage user accounts and permissions.</p>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            className="pl-8 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No users found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">User</TableHead>
                  <TableHead className="text-xs hidden sm:table-cell">Role</TableHead>
                  <TableHead className="text-xs hidden sm:table-cell">Joined</TableHead>
                  <TableHead className="text-xs hidden md:table-cell">Last Sign In</TableHead>
                  <TableHead className="text-xs text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{user.full_name}</span>
                          {user.is_banned && (
                            <Badge variant="destructive" className="text-[10px]">Banned</Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">{user.email}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant={user.role === "admin" ? "default" : "secondary"} className="text-xs">
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(user.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                      {user.last_sign_in
                        ? formatDistanceToNow(new Date(user.last_sign_in), { addSuffix: true })
                        : "Never"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {user.is_banned ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-7"
                            onClick={() => handleUnban(user.id)}
                            disabled={actionLoading === user.id}
                          >
                            {actionLoading === user.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <ShieldCheck className="h-3 w-3" />
                            )}
                            <span className="hidden sm:inline ml-1">Unban</span>
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-7 text-destructive"
                            onClick={() => handleBan(user.id)}
                            disabled={actionLoading === user.id}
                          >
                            {actionLoading === user.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Ban className="h-3 w-3" />
                            )}
                            <span className="hidden sm:inline ml-1">Ban</span>
                          </Button>
                        )}
                        {user.role === "admin" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-7"
                            onClick={() => handleDemote(user.id)}
                            disabled={actionLoading === user.id}
                          >
                            <UserMinus className="h-3 w-3" />
                            <span className="hidden sm:inline ml-1">Demote</span>
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-7"
                            onClick={() => handlePromote(user.id)}
                            disabled={actionLoading === user.id}
                          >
                            <UserPlus className="h-3 w-3" />
                            <span className="hidden sm:inline ml-1">Promote</span>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
