import * as React from "react";
import { requireAdmin } from "@/lib/auth/guards";
import { logoutAction } from "@/app/(auth)/actions";
import {
  Layers,
  Users,
  Calendar,
  LayoutDashboard,
  FileText,
  Activity,
  LogOut,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { NotificationBell } from "@/components/notifications/notification-bell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdmin();

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      {/* Sidebar Navigation */}
      <aside className="w-64 h-screen border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 flex flex-col justify-between shrink-0 z-30">
        <div className="flex flex-col min-h-0">
          {/* Brand */}
          <div className="h-16 shrink-0 flex items-center px-6 border-b border-zinc-200 dark:border-zinc-800 gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold shadow-sm">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <span className="font-semibold text-sm tracking-tight text-zinc-900 dark:text-zinc-100">
                DigiCanvas
              </span>
              <span className="block text-[10px] uppercase font-semibold text-zinc-400 tracking-wider">
                Agency Admin
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1 overflow-y-auto">
            <Link
              href="/admin"
              className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md hover:bg-zinc-100 text-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition"
            >
              <LayoutDashboard className="h-4 w-4 text-zinc-500" />
              Overview
            </Link>
            <Link
              href="/admin/clients"
              className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md hover:bg-zinc-100 text-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition"
            >
              <Users className="h-4 w-4 text-zinc-500" />
              Clients
            </Link>
            <Link
              href="/admin/content"
              className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md hover:bg-zinc-100 text-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition"
            >
              <FileText className="h-4 w-4 text-zinc-500" />
              Content
            </Link>
            <Link
              href="/admin/calendar"
              className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md hover:bg-zinc-100 text-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition"
            >
              <Calendar className="h-4 w-4 text-zinc-500" />
              Calendar
            </Link>
            <Link
              href="/admin/activity"
              className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md hover:bg-zinc-100 text-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition"
            >
              <Activity className="h-4 w-4 text-zinc-500" />
              Activity
            </Link>
          </nav>
        </div>

        {/* User Account / Session Profile Footer */}
        <div className="p-3 shrink-0 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="px-3 py-2 rounded-md bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 mb-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                {session.user.name}
              </p>
              <Badge variant="default" className="text-[10px] px-1.5 py-0 font-mono">
                {session.user.role}
              </Badge>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
              {session.user.email}
            </p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded transition"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out Session
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <header className="h-16 shrink-0 border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 flex items-center justify-between px-8 z-20">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-zinc-500">Agency Workspace /</span>
            <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Portal</span>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell isAdmin={true} />
            <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500 font-medium border-l border-zinc-200 dark:border-zinc-800 pl-3">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Live Workspace
            </span>
          </div>
        </header>

        <main className="flex-1 p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
