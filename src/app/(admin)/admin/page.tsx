import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { 
  Building2, 
  CalendarDays, 
  Plus, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  FileText, 
  ArrowRight,
  History,
  Instagram,
  Facebook,
  Linkedin,
  Youtube,
  Twitter,
} from "lucide-react";
import { ApprovalStatus, OrganizationStatus } from "@prisma/client";

function getPlatformIcon(platform: string) {
  switch (platform) {
    case "INSTAGRAM":
      return <Instagram className="h-3.5 w-3.5 text-pink-600" />;
    case "FACEBOOK":
      return <Facebook className="h-3.5 w-3.5 text-blue-600" />;
    case "LINKEDIN":
      return <Linkedin className="h-3.5 w-3.5 text-blue-700" />;
    case "YOUTUBE":
      return <Youtube className="h-3.5 w-3.5 text-red-600" />;
    case "TWITTER":
    case "X":
      return <Twitter className="h-3.5 w-3.5 text-zinc-800 dark:text-zinc-200" />;
    default:
      return null;
  }
}

export default async function AdminDashboardPage() {
  const session = await requireAdmin();

  // Fetch real live metrics and pending items
  const [
    activeClientCount,
    awaitingApprovalCount,
    changesRequestedCount,
    approvedCount,
    pendingActionContent,
    recentActivityLogs,
  ] = await Promise.all([
    prisma.organization.count({
      where: { status: OrganizationStatus.ACTIVE },
    }).catch(() => 0),
    prisma.content.count({
      where: { archivedAt: null, approvalStatus: ApprovalStatus.AWAITING_APPROVAL },
    }).catch(() => 0),
    prisma.content.count({
      where: { archivedAt: null, approvalStatus: ApprovalStatus.CHANGES_REQUESTED },
    }).catch(() => 0),
    prisma.content.count({
      where: { archivedAt: null, approvalStatus: ApprovalStatus.APPROVED },
    }).catch(() => 0),
    prisma.content.findMany({
      where: {
        archivedAt: null,
        approvalStatus: {
          in: [ApprovalStatus.CHANGES_REQUESTED, ApprovalStatus.AWAITING_APPROVAL],
        },
      },
      include: {
        organization: { select: { name: true, slug: true } },
        platforms: { select: { platform: true } },
      },
      orderBy: { scheduledAt: "asc" },
      take: 5,
    }).catch(() => []),
    prisma.activityLog.findMany({
      include: {
        actor: { select: { name: true, email: true, role: true } },
        organization: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }).catch(() => []),
  ]);

  return (
    <div className="max-w-6xl space-y-6">
      {/* Header & Quick Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Agency Overview
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Monitor client content pipelines, pending approvals, and scheduled posts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/calendar"
            className="inline-flex items-center justify-center rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-900 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
          >
            <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
            Calendar
          </Link>
          <Link
            href="/admin/clients/new"
            className="inline-flex items-center justify-center rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-900 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
          >
            <Building2 className="h-3.5 w-3.5 mr-1.5" />
            Add Client
          </Link>
          <Link
            href="/admin/content/new"
            className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white shadow hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New Post
          </Link>
        </div>
      </div>

      {/* Operational Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border border-zinc-200 dark:border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Active Clients
            </CardTitle>
            <Building2 className="h-4 w-4 text-zinc-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{activeClientCount}</div>
            <Link href="/admin/clients" className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 mt-1">
              Manage client portals <ArrowRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>

        <Card className="border border-amber-200/60 dark:border-amber-900/40 bg-amber-50/30 dark:bg-amber-950/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-amber-700 dark:text-amber-400 uppercase tracking-wider">
              Awaiting Approval
            </CardTitle>
            <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-900 dark:text-amber-100">{awaitingApprovalCount}</div>
            <p className="text-xs text-amber-700/70 dark:text-amber-400/70 mt-1">Pending review with clients</p>
          </CardContent>
        </Card>

        <Card className="border border-red-200/60 dark:border-red-900/40 bg-red-50/30 dark:bg-red-950/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-red-700 dark:text-red-400 uppercase tracking-wider">
              Changes Requested
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-900 dark:text-red-100">{changesRequestedCount}</div>
            <p className="text-xs text-red-700/70 dark:text-red-400/70 mt-1">Requires revision by agency</p>
          </CardContent>
        </Card>

        <Card className="border border-emerald-200/60 dark:border-emerald-900/40 bg-emerald-50/30 dark:bg-emerald-950/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
              Approved Posts
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">{approvedCount}</div>
            <p className="text-xs text-emerald-700/70 dark:text-emerald-400/70 mt-1">Ready for publishing</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Posts Needing Attention */}
        <Card className="lg:col-span-2 border border-zinc-200 dark:border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Action Items & Pending Posts
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Content requiring client review or agency revisions
              </CardDescription>
            </div>
            <Link
              href="/admin/content"
              className="text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 inline-flex items-center gap-1 font-medium"
            >
              All Content <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {pendingActionContent.length === 0 ? (
              <div className="text-center py-8 text-zinc-500 dark:text-zinc-400 text-sm">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                <p className="font-medium">No pending action items!</p>
                <p className="text-xs text-zinc-400 mt-0.5">All scheduled content has been approved or draft.</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {pendingActionContent.map((item) => (
                  <div key={item.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                          {item.organization.name}
                        </span>
                        <div className="flex items-center gap-1">
                          {item.platforms.map((p) => (
                            <span key={p.platform} title={p.platform}>
                              {getPlatformIcon(p.platform)}
                            </span>
                          ))}
                        </div>
                      </div>
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                        {item.title}
                      </p>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Scheduled: {new Date(item.scheduledAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {item.approvalStatus === ApprovalStatus.CHANGES_REQUESTED ? (
                        <Badge variant="destructive" className="text-[11px]">Changes Requested</Badge>
                      ) : (
                        <Badge variant="warning" className="text-[11px]">Awaiting Approval</Badge>
                      )}
                      <Link
                        href={`/admin/content/${item.id}/edit`}
                        className="inline-flex items-center justify-center rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-900 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
                      >
                        Edit
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Audit & Activity Stream */}
        <Card className="border border-zinc-200 dark:border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                <History className="h-4 w-4 text-zinc-500" />
                Recent Activity
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Latest agency & client actions
              </CardDescription>
            </div>
            <Link
              href="/admin/activity"
              className="text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 inline-flex items-center gap-1 font-medium"
            >
              Audit Log <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {recentActivityLogs.length === 0 ? (
              <div className="text-center py-8 text-zinc-500 dark:text-zinc-400 text-sm">
                <FileText className="h-8 w-8 text-zinc-400 mx-auto mb-2 opacity-50" />
                <p className="text-xs">No recent activity logged.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentActivityLogs.map((log) => (
                  <div key={log.id} className="text-xs border-b border-zinc-100 dark:border-zinc-800/60 pb-2.5 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between text-zinc-500 text-[11px] mb-0.5">
                      <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate max-w-[140px]">
                        {log.actor?.name || log.actor?.email || "System"}
                      </span>
                      <span>
                        {new Date(log.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="font-semibold text-zinc-700 dark:text-zinc-300">
                      {log.action.replace(/_/g, " ")}
                    </p>
                    {log.organization?.name && (
                      <p className="text-[11px] text-zinc-400">
                        {log.organization.name}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
