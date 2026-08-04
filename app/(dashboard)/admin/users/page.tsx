"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { getAdminUsers, banUser, unbanUser, promoteToAdmin, demoteToUser } from "@/lib/actions/admin";
import type { AdminUser } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Breadcrumbs } from "@/components/breadcrumbs";
import {
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Users,
  ShieldCheck,
  Ban,
  UserCog,
  Ban as BanIcon,
  ShieldCheck as ShieldIcon,
  UserMinus,
  UserPlus,
  ShieldAlert,
  UserCog as UserCogIcon,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(30);

  async function loadUsers() {
    setLoading(true);
    const data = await getAdminUsers();
    setUsers(data);
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    getAdminUsers().then((data) => {
      if (cancelled) return;
      setUsers(data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const router = useRouter();
  const [confirmAction, setConfirmAction] = useState<
    { action: "ban" | "unban" | "promote" | "demote"; user: AdminUser } | null
  >(null);

  async function executeAction(action: "ban" | "unban" | "promote" | "demote", userId: string) {
    setActionLoading(userId);
    const result =
      action === "ban"
        ? await banUser(userId)
        : action === "unban"
          ? await unbanUser(userId)
          : action === "promote"
            ? await promoteToAdmin(userId)
            : await demoteToUser(userId);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(
        action === "ban"
          ? "User banned"
          : action === "unban"
            ? "User unbanned"
            : action === "promote"
              ? "User promoted to admin"
              : "User demoted to user",
      );
      await loadUsers();
    }
    setActionLoading(null);
    setConfirmAction(null);
  }

  const stats = useMemo(() => {
    return {
      total: users.length,
      active: users.filter((u) => !u.is_banned).length,
      banned: users.filter((u) => u.is_banned).length,
      admins: users.filter((u) => u.role === "admin").length,
    };
  }, [users]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((u) => {
      const matchesSearch =
        !term ||
        u.email.toLowerCase().includes(term) ||
        u.full_name.toLowerCase().includes(term);
      const matchesRole = roleFilter === "all" || u.role === roleFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "banned" && u.is_banned) ||
        (statusFilter === "active" && !u.is_banned);
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  const hasActiveFilters = search !== "" || roleFilter !== "all" || statusFilter !== "all";

  function clearAll() {
    setSearch("");
    setRoleFilter("all");
    setStatusFilter("all");
    setPage(1);
  }

  function initials(name: string) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  return (
    <div className="space-y-6">
      <div className="-mx-6 border-b border-border pb-6">
        <div className="flex items-center justify-between px-6">
          <div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight">Users</h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              Manage user accounts, roles, and access across the platform.
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={loadUsers}>
            <Loader2 className={`size-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Breadcrumbs />

      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <QuickStat icon={Users} label="Total Users" value={stats.total.toLocaleString()} color="text-blue-500" bgColor="bg-blue-500/10" />
        <QuickStat icon={ShieldCheck} label="Active" value={stats.active.toLocaleString()} color="text-emerald-500" bgColor="bg-emerald-500/10" />
        <QuickStat icon={Ban} label="Banned" value={stats.banned.toLocaleString()} color="text-rose-500" bgColor="bg-rose-500/10" />
        <QuickStat icon={UserCog} label="Admins" value={stats.admins.toLocaleString()} color="text-violet-500" bgColor="bg-violet-500/10" />
      </div>

      {/* Search, filter, per page, pagination — one row */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative w-full lg:w-72">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name or email..."
            className="h-10 pl-9 pr-9 text-sm"
          />
          {search && (
            <button
              onClick={() => { setSearch(""); setPage(1); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-xs text-muted-foreground">Role</span>
          <Select
            value={roleFilter}
            onValueChange={(v) => { setRoleFilter(v ?? "all"); setPage(1); }}
          >
            <SelectTrigger className="h-10 w-full lg:w-[130px]">
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value="user">User</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-xs text-muted-foreground">Status</span>
          <Select
            value={statusFilter}
            onValueChange={(v) => { setStatusFilter(v ?? "all"); setPage(1); }}
          >
            <SelectTrigger className="h-10 w-full lg:w-[130px]">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="banned">Banned</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1 lg:ml-auto">
          <span className="text-xs text-muted-foreground">Per page</span>
          <Select
            value={String(perPage)}
            onValueChange={(v) => { setPerPage(Number(v ?? 30)); setPage(1); }}
          >
            <SelectTrigger className="h-10 w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[20, 30, 50, 100].map((opt) => (
                <SelectItem key={opt} value={String(opt)}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="h-10 w-10 p-0"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-10 w-10 p-0"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* Active filters */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2">
          {search && (
            <span className="inline-flex items-center gap-1 rounded-4xl bg-muted px-2.5 py-1 text-xs">
              &quot;{search}&quot;
              <button onClick={() => setSearch("")} className="ml-0.5 hover:text-foreground">
                <X className="size-3" />
              </button>
            </span>
          )}
          {roleFilter !== "all" && (
            <span className="inline-flex items-center gap-1 rounded-4xl bg-muted px-2.5 py-1 text-xs capitalize">
              Role: {roleFilter}
              <button onClick={() => setRoleFilter("all")} className="ml-0.5 hover:text-foreground">
                <X className="size-3" />
              </button>
            </span>
          )}
          {statusFilter !== "all" && (
            <span className="inline-flex items-center gap-1 rounded-4xl bg-muted px-2.5 py-1 text-xs capitalize">
              Status: {statusFilter}
              <button onClick={() => setStatusFilter("all")} className="ml-0.5 hover:text-foreground">
                <X className="size-3" />
              </button>
            </span>
          )}
          <button onClick={clearAll} className="text-xs text-muted-foreground hover:text-foreground">
            Clear all
          </button>
        </div>
      )}

      {/* Results count */}
      <div className="text-xs text-muted-foreground">
        {filtered.length} user{filtered.length !== 1 ? "s" : ""} found
      </div>

      {/* Table */}
      {loading ? (
        <div className="rounded-4xl border border-border">
          <div className="bg-muted/50 px-4 py-3">
            <div className="flex gap-4">
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
          <div className="divide-y divide-border">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="px-4 py-3">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-3 w-8" />
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-8 shrink-0 rounded-full" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-3 w-32" />
                      <Skeleton className="h-2.5 w-40" />
                    </div>
                  </div>
                  <Skeleton className="h-5 w-14 rounded-full" />
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-28" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : paged.length > 0 ? (
        <div className="rounded-4xl border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground w-10">#</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">User</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">Role</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Joined</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Last Sign In</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((user, index) => (
                <tr
                  key={user.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {(page - 1) * perPage + index + 1}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {user.avatar_url ? (
                        <Image
                          src={user.avatar_url}
                          alt={user.full_name}
                          width={32}
                          height={32}
                          className="size-8 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                          {initials(user.full_name)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => router.push(`/admin/users/${user.id}`)}
                            className="truncate font-medium hover:underline"
                          >
                            {user.full_name}
                          </button>
                          {user.is_banned && (
                            <Badge variant="destructive" className="text-[10px]">Banned</Badge>
                          )}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="hidden sm:table-cell px-4 py-3">
                    <Badge variant={user.role === "admin" ? "default" : "secondary"} className="text-xs">
                      {user.role}
                    </Badge>
                  </td>
                  <td className="hidden md:table-cell px-4 py-3 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(user.created_at), { addSuffix: true })}
                  </td>
                  <td className="hidden lg:table-cell px-4 py-3 text-xs text-muted-foreground">
                    {user.last_sign_in
                      ? formatDistanceToNow(new Date(user.last_sign_in), { addSuffix: true })
                      : "Never"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {user.is_banned ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={(e) => { e.stopPropagation(); setConfirmAction({ action: "unban", user }); }}
                          disabled={actionLoading === user.id}
                        >
                          {actionLoading === user.id ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <ShieldIcon className="size-3" />
                          )}
                          <span className="hidden sm:inline ml-1">Unban</span>
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-destructive"
                          onClick={(e) => { e.stopPropagation(); setConfirmAction({ action: "ban", user }); }}
                          disabled={actionLoading === user.id}
                        >
                          {actionLoading === user.id ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <BanIcon className="size-3" />
                          )}
                          <span className="hidden sm:inline ml-1">Ban</span>
                        </Button>
                      )}
                      {user.role === "admin" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={(e) => { e.stopPropagation(); setConfirmAction({ action: "demote", user }); }}
                          disabled={actionLoading === user.id}
                        >
                          <UserMinus className="size-3" />
                          <span className="hidden sm:inline ml-1">Demote</span>
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={(e) => { e.stopPropagation(); setConfirmAction({ action: "promote", user }); }}
                          disabled={actionLoading === user.id}
                        >
                          <UserPlus className="size-3" />
                          <span className="hidden sm:inline ml-1">Promote</span>
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-4xl border border-dashed border-border p-12 text-center">
          <p className="text-sm text-muted-foreground">
            {hasActiveFilters
              ? "No users match your filters."
              : "No users yet."}
          </p>
        </div>
      )}

      {confirmAction && (
        <ConfirmDialog
          action={confirmAction.action}
          user={confirmAction.user}
          loading={actionLoading === confirmAction.user.id}
          onConfirm={() => executeAction(confirmAction.action, confirmAction.user.id)}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}

const CONFIRM_CONFIG = {
  ban: {
    title: "Ban user",
    description:
      "This will immediately revoke access for this user. They will be signed out and blocked from signing in again.",
    confirmLabel: "Ban user",
    icon: BanIcon,
    iconBg: "bg-destructive/10",
    iconColor: "text-destructive",
    buttonClass: "text-destructive",
  },
  unban: {
    title: "Unban user",
    description:
      "This will restore access for this user and allow them to sign in again.",
    confirmLabel: "Unban user",
    icon: ShieldIcon,
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-500",
    buttonClass: "",
  },
  promote: {
    title: "Promote to admin",
    description:
      "This grants this user full admin access, including the ability to ban users and manage settings. Make sure you trust them.",
    confirmLabel: "Promote to admin",
    icon: UserCogIcon,
    iconBg: "bg-violet-500/10",
    iconColor: "text-violet-500",
    buttonClass: "",
  },
  demote: {
    title: "Demote to user",
    description:
      "This revokes admin access and returns this user to a regular account.",
    confirmLabel: "Demote to user",
    icon: ShieldAlert,
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-500",
    buttonClass: "",
  },
} satisfies Record<
  "ban" | "unban" | "promote" | "demote",
  {
    title: string;
    description: string;
    confirmLabel: string;
    icon: React.ComponentType<{ className?: string }>;
    iconBg: string;
    iconColor: string;
    buttonClass: string;
  }
>;

function ConfirmDialog({
  action,
  user,
  loading,
  onConfirm,
  onCancel,
}: {
  action: "ban" | "unban" | "promote" | "demote";
  user: AdminUser;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const config = CONFIRM_CONFIG[action];
  const Icon = config.icon;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={() => {
        if (!loading) onCancel();
      }}
    >
      <div
        className="w-full max-w-md rounded-4xl bg-card p-6 shadow-md ring-1 ring-foreground/5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className={`flex size-10 items-center justify-center rounded-full ${config.iconBg}`}>
            <Icon className={`size-5 ${config.iconColor}`} />
          </div>
          <div>
            <h2 className="font-heading text-base font-medium text-card-foreground">
              {config.title}
            </h2>
            <p className="text-sm text-muted-foreground">This action can be undone</p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-4xl border border-border bg-muted/40 p-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-background text-sm font-medium text-muted-foreground">
            {user.full_name
              .split(" ")
              .map((n) => n[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user.full_name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>

        <p className="mt-4 text-sm text-muted-foreground">{config.description}</p>

        <div className="mt-5 flex justify-end gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant={action === "ban" ? "destructive" : "default"}
            size="sm"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading && <Loader2 className="size-3 animate-spin" />}
            {config.confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

function QuickStat({
  icon: Icon,
  label,
  value,
  color,
  bgColor,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  color: string;
  bgColor: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-4xl border border-border bg-card p-4">
      <div className={`flex size-10 items-center justify-center rounded-4xl ${bgColor}`}>
        <Icon className={`size-5 ${color}`} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xl font-bold tracking-tight">{value}</p>
        <p className="truncate text-[11px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
