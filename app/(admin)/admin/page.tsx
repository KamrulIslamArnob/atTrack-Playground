import { getAdminDashboardStats } from "@/lib/actions/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Briefcase, FileText, MessageSquare, Cpu, Activity, Ban, ShieldCheck } from "lucide-react";
import { ActivityLogItem } from "@/components/activity-log-item";

export default async function AdminDashboardPage() {
  const stats = await getAdminDashboardStats();

  const statCards = [
    { label: "Total Users", value: stats.totalUsers, icon: Users, color: "text-blue-600" },
    { label: "Active Users", value: stats.activeUsers, icon: ShieldCheck, color: "text-green-600" },
    { label: "Banned Users", value: stats.bannedUsers, icon: Ban, color: "text-red-600" },
    { label: "Total Jobs", value: stats.totalJobs, icon: Briefcase, color: "text-purple-600" },
    { label: "Applications", value: stats.totalApplications, icon: FileText, color: "text-orange-600" },
    { label: "Interviews", value: stats.totalInterviews, icon: MessageSquare, color: "text-cyan-600" },
    { label: "Documents", value: stats.totalDocuments, icon: FileText, color: "text-pink-600" },
    { label: "AI Requests", value: stats.totalAiRequests, icon: Cpu, color: "text-indigo-600" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Overview of system usage and activity.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                    <p className="text-xl sm:text-2xl font-bold">{stat.value}</p>
                  </div>
                  <Icon className={`h-5 w-5 sm:h-6 sm:w-6 ${stat.color}`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
            <Activity className="h-4 w-4" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent activity.</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {stats.recentActivity.map((log) => (
                <ActivityLogItem key={log.id} log={log} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
