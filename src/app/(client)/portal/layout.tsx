import * as React from "react";
import { requireClient } from "@/lib/auth/guards";
import { logoutAction } from "@/app/(auth)/actions";
import {
  Layers,
  Calendar,
  LayoutDashboard,
  LogOut,
  Globe2,
} from "lucide-react";
import Link from "next/link";
import { NotificationBell } from "@/components/notifications/notification-bell";

export default async function ClientPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireClient();
  const organization = session.user.organization;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      {/* Client Top Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 shadow-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Link href="/portal" className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold">
                <Layers className="h-4 w-4" />
              </div>
              <div>
                <span className="font-semibold text-sm tracking-tight text-zinc-900 dark:text-zinc-100">
                  {organization?.name ?? "Client Portal"}
                </span>
                <span className="block text-[10px] text-zinc-400">
                  Client Portal
                </span>
              </div>
            </Link>

            <nav className="hidden sm:flex items-center gap-1 border-l border-zinc-200 dark:border-zinc-800 pl-4">
              <Link
                href="/portal"
                className="px-3 py-1.5 text-xs font-medium rounded-md hover:bg-zinc-100 text-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition flex items-center gap-1.5"
              >
                <LayoutDashboard className="h-3.5 w-3.5 text-zinc-400" />
                <span>Dashboard</span>
              </Link>
              <Link
                href="/portal/calendar"
                className="px-3 py-1.5 text-xs font-medium rounded-md hover:bg-zinc-100 text-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition flex items-center gap-1.5"
              >
                <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                <span>Calendar</span>
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-1.5 text-xs text-zinc-500 mr-2">
              <Globe2 className="h-3.5 w-3.5 text-zinc-400" />
              <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                {organization?.timezone ?? "Asia/Kolkata"}
              </span>
            </div>

            <NotificationBell isAdmin={false} />

            <div className="hidden sm:flex flex-col text-right pl-1 border-l border-zinc-200 dark:border-zinc-800">
              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                {session.user.name}
              </span>
              <span className="text-[11px] text-zinc-500 truncate max-w-[160px]">
                {session.user.email}
              </span>
            </div>

            <form action={logoutAction}>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 transition border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 mx-auto w-full max-w-6xl p-4 sm:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
